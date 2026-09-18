// ---------- SQLite 适配器（Node 24 内置 node:sqlite，零依赖） ----------
// 实现 contract.js 的全部方法；SQL 使用 ? 占位符，与 MySQL 语法保持一致。
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('../utils/password');
const { now } = require('../utils/clock');
const seed = require('./seed-data');

let db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('consumer','service','warehouse'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id              TEXT NOT NULL,
  order_id        TEXT NOT NULL REFERENCES orders(id),
  name            TEXT NOT NULL,
  price           INTEGER NOT NULL,
  qty             INTEGER NOT NULL,
  aftersalable_qty INTEGER NOT NULL,
  PRIMARY KEY (order_id, id)
);
CREATE TABLE IF NOT EXISTS aftersale_tickets (
  id                 TEXT PRIMARY KEY,
  seq                INTEGER NOT NULL UNIQUE,
  order_id           TEXT NOT NULL REFERENCES orders(id),
  item_id            TEXT NOT NULL,
  user_id            TEXT NOT NULL REFERENCES users(id),
  type               TEXT NOT NULL CHECK (type IN ('RETURN','EXCHANGE')),
  reason             TEXT NOT NULL,
  qty                INTEGER NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL,
  refund_amount      INTEGER,
  reship_tracking_no TEXT,
  inspect_result     TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS aftersale_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  TEXT NOT NULL REFERENCES aftersale_tickets(id),
  filename   TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS aftersale_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id      TEXT NOT NULL REFERENCES aftersale_tickets(id),
  operator_name  TEXT NOT NULL,
  operator_role  TEXT NOT NULL,
  action         TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL
);
`;

function open(cfg) {
  fs.mkdirSync(path.dirname(cfg.file), { recursive: true });
  db = new DatabaseSync(cfg.file);
  db.exec('PRAGMA foreign_keys = ON;');
}

async function init(cfg) {
  open(cfg);
  db.exec(SCHEMA);
  await seedIfEmpty();
}

async function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return;
  const insUser = db.prepare(
    'INSERT INTO users (id, username, password_hash, salt, name, role) VALUES (?,?,?,?,?,?)');
  for (const u of seed.users) {
    const { salt, hash } = hashPassword(u.password);
    insUser.run(u.id, u.username, hash, salt, u.name, u.role);
  }
  const insOrder = db.prepare('INSERT INTO orders (id, user_id, status, created_at) VALUES (?,?,?,?)');
  const insItem = db.prepare(
    'INSERT INTO order_items (id, order_id, name, price, qty, aftersalable_qty) VALUES (?,?,?,?,?,?)');
  for (const o of seed.orders) {
    insOrder.run(o.id, o.userId, o.status, o.createdAt);
    for (const it of o.items) insItem.run(it.id, o.id, it.name, it.price, it.qty, it.aftersalableQty);
  }
}

async function reset() {
  db.exec('DROP TABLE IF EXISTS aftersale_events; DROP TABLE IF EXISTS aftersale_images;' +
    ' DROP TABLE IF EXISTS aftersale_tickets; DROP TABLE IF EXISTS order_items;' +
    ' DROP TABLE IF EXISTS orders; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS users;');
  db.exec(SCHEMA);
  await seedIfEmpty();
}

async function userCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

// ---------- 用户与会话 ----------
async function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}
async function findUserByToken(token) {
  return db.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .get(token) || null;
}
async function createSession(token, userId) {
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)')
    .run(token, userId, now());
}
async function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ---------- 订单 ----------
async function listCompletedOrdersWithItems(userId) {
  const orders = db.prepare(
    "SELECT * FROM orders WHERE user_id = ? AND status = 'COMPLETED' ORDER BY rowid")
    .all(userId);
  const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid');
  const usedStmt = db.prepare(
    `SELECT item_id, COALESCE(SUM(qty),0) AS used FROM aftersale_tickets
     WHERE order_id = ? AND status NOT IN ('REJECTED','CLOSED') GROUP BY item_id`);
  for (const o of orders) {
    const usedMap = Object.fromEntries(usedStmt.all(o.id).map(r => [r.item_id, r.used]));
    o.items = itemStmt.all(o.id).map(it => ({ ...it, usedQty: usedMap[it.id] || 0 }));
  }
  return orders;
}
async function findOrderItem(orderId, itemId) {
  return db.prepare(
    `SELECT i.*, o.user_id AS order_user_id, o.status AS order_status
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE i.order_id = ? AND i.id = ?`).get(orderId, itemId) || null;
}

// ---------- 售后单 ----------
const IN_FLIGHT = "status NOT IN ('REJECTED','CLOSED')";

async function usedAftersaleQty(orderId, itemId) {
  const { used } = db.prepare(
    `SELECT COALESCE(SUM(qty),0) AS used FROM aftersale_tickets
     WHERE order_id = ? AND item_id = ? AND ${IN_FLIGHT}`).get(orderId, itemId);
  return used;
}

// 数量校验 + 写入放在同一事务内，保证“校验那一刻到插入那一刻”之间数量不被并发申请占用
async function createTicketIfAvailable(data) {
  const begin = () => db.exec('BEGIN IMMEDIATE');
  const commit = () => db.exec('COMMIT');
  const rollback = () => db.exec('ROLLBACK');
  begin();
  try {
    const item = db.prepare(
      'SELECT aftersalable_qty FROM order_items WHERE order_id = ? AND id = ?')
      .get(data.orderId, data.itemId);
    if (!item) { rollback(); return { ok: false, available: 0 }; }
    const used = await usedAftersaleQty(data.orderId, data.itemId);
    const available = item.aftersalable_qty - used;
    if (data.qty > available) { rollback(); return { ok: false, available }; }
    const { nextSeq } = db.prepare(
      'SELECT COALESCE(MAX(seq),0) + 1 AS nextSeq FROM aftersale_tickets').get();
    const id = 'AS' + String(nextSeq).padStart(4, '0');
    db.prepare(
      `INSERT INTO aftersale_tickets
       (id, seq, order_id, item_id, user_id, type, reason, qty, description, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, nextSeq, data.orderId, data.itemId, data.userId, data.type, data.reason,
        data.qty, data.description, data.status, data.createdAt, data.createdAt);
    commit();
    return { ok: true, id };
  } catch (e) { rollback(); throw e; }
}

const TICKET_SELECT = `
  SELECT t.*, i.name AS item_name, i.price, u.name AS user_name
  FROM aftersale_tickets t
  JOIN order_items i ON i.order_id = t.order_id AND i.id = t.item_id
  JOIN users u ON u.id = t.user_id`;

async function findTicketById(id) {
  return db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(id) || null;
}
async function listTickets({ userId, status, type } = {}) {
  const where = [], params = [];
  if (userId) { where.push('t.user_id = ?'); params.push(userId); }
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (type) { where.push('t.type = ?'); params.push(type); }
  const sql = `${TICKET_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.seq DESC`;
  return db.prepare(sql).all(...params);
}
async function setTicketDescription(id, text) {
  db.prepare('UPDATE aftersale_tickets SET description = ?, updated_at = ? WHERE id = ?')
    .run(text, now(), id);
}
const UPDATABLE = ['status', 'refund_amount', 'reship_tracking_no', 'inspect_result'];
async function updateTicket(id, fields) {
  const sets = [], params = [];
  for (const k of UPDATABLE) {
    if (k in fields) { sets.push(`${k} = ?`); params.push(fields[k]); }
  }
  if (!sets.length) return;
  sets.push('updated_at = ?'); params.push(now(), id);
  db.prepare(`UPDATE aftersale_tickets SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}
async function addTicketImages(id, filenames) {
  const stmt = db.prepare(
    'INSERT INTO aftersale_images (ticket_id, filename, created_at) VALUES (?,?,?)');
  for (const f of filenames) stmt.run(id, f, now());
}
async function listTicketImages(id) {
  return db.prepare(
    'SELECT filename FROM aftersale_images WHERE ticket_id = ? ORDER BY id')
    .all(id).map(r => r.filename);
}
async function addTicketEvent(id, { operatorName, operatorRole, action, note }) {
  db.prepare(
    `INSERT INTO aftersale_events (ticket_id, operator_name, operator_role, action, note, created_at)
     VALUES (?,?,?,?,?,?)`)
    .run(id, operatorName, operatorRole, action, note || '', now());
}
async function listTicketEvents(id) {
  return db.prepare(
    `SELECT created_at, operator_name, operator_role, action, note
     FROM aftersale_events WHERE ticket_id = ? ORDER BY id`).all(id);
}

async function close() { db.close(); }

module.exports = {
  init, reset, close, userCount,
  findUserByUsername, findUserByToken, createSession, deleteSession,
  listCompletedOrdersWithItems, findOrderItem,
  usedAftersaleQty, createTicketIfAvailable,
  findTicketById, listTickets, setTicketDescription, updateTicket,
  addTicketImages, listTicketImages, addTicketEvent, listTicketEvents,
};
