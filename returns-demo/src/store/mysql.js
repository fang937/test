// ---------- MySQL 适配器（接入其他设备上的 MySQL 服务器） ----------
// 使用前在目标设备上安装驱动：npm install mysql2
// 然后通过环境变量指定连接信息启动，例如：
//   DB_DRIVER=mysql DB_HOST=192.168.1.20 DB_PORT=3306 DB_USER=returns DB_PASSWORD=xxx DB_NAME=returns_demo npm start
// 首次启动会自动建库（需账号有建库权限）、建表并写入演示数据；
// 若数据库由 DBA 预先创建，账号只需对该库有读写权限即可。
let pool;
let mysql;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR(20) PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash CHAR(64) NOT NULL,
    salt          CHAR(32) NOT NULL,
    name          VARCHAR(50) NOT NULL,
    role          VARCHAR(20) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token      VARCHAR(64) PRIMARY KEY,
    user_id    VARCHAR(20) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    INDEX idx_sessions_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS orders (
    id         VARCHAR(20) PRIMARY KEY,
    user_id    VARCHAR(20) NOT NULL,
    status     VARCHAR(20) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    INDEX idx_orders_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id               VARCHAR(20) NOT NULL,
    order_id         VARCHAR(20) NOT NULL,
    name             VARCHAR(100) NOT NULL,
    price            INT NOT NULL,
    qty              INT NOT NULL,
    aftersalable_qty INT NOT NULL,
    PRIMARY KEY (order_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS aftersale_tickets (
    id                 VARCHAR(20) PRIMARY KEY,
    seq                INT NOT NULL UNIQUE,
    order_id           VARCHAR(20) NOT NULL,
    item_id            VARCHAR(20) NOT NULL,
    user_id            VARCHAR(20) NOT NULL,
    type               VARCHAR(10) NOT NULL,
    reason             VARCHAR(100) NOT NULL,
    qty                INT NOT NULL,
    description        TEXT,
    status             VARCHAR(30) NOT NULL,
    refund_amount      INT NULL,
    reship_tracking_no VARCHAR(40) NULL,
    inspect_result     VARCHAR(10) NULL,
    created_at         VARCHAR(32) NOT NULL,
    updated_at         VARCHAR(32) NOT NULL,
    INDEX idx_tickets_order_item (order_id, item_id),
    INDEX idx_tickets_user (user_id),
    INDEX idx_tickets_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS aftersale_images (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id  VARCHAR(20) NOT NULL,
    filename   VARCHAR(200) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    INDEX idx_images_ticket (ticket_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS aftersale_events (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id     VARCHAR(20) NOT NULL,
    operator_name VARCHAR(50) NOT NULL,
    operator_role VARCHAR(20) NOT NULL,
    action        VARCHAR(50) NOT NULL,
    note          TEXT,
    created_at    VARCHAR(32) NOT NULL,
    INDEX idx_events_ticket (ticket_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function init(cfg) {
  // 懒加载：只有选择 mysql 驱动时才要求安装 mysql2
  mysql = (await import('mysql2/promise')).default;
  // 先不指定数据库连接，确保目标库存在（无建库权限时可让 DBA 预先创建）
  const boot = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
  });
  await boot.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` DEFAULT CHARACTER SET utf8mb4`);
  await boot.end();

  pool = mysql.createPool({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    database: cfg.database, connectionLimit: 8, charset: 'utf8mb4',
  });
  for (const ddl of SCHEMA) await pool.query(ddl);
  await seedIfEmpty();
}

async function seedIfEmpty() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (n > 0) return;
  const { hashPassword } = require('../utils/password');
  const { now } = require('../utils/clock');
  const seed = require('./seed-data');
  for (const u of seed.users) {
    const { salt, hash } = hashPassword(u.password);
    await pool.query(
      'INSERT INTO users (id, username, password_hash, salt, name, role) VALUES (?,?,?,?,?,?)',
      [u.id, u.username, hash, salt, u.name, u.role]);
  }
  for (const o of seed.orders) {
    await pool.query('INSERT INTO orders (id, user_id, status, created_at) VALUES (?,?,?,?)',
      [o.id, o.userId, o.status, o.createdAt]);
    for (const it of o.items) {
      await pool.query(
        'INSERT INTO order_items (id, order_id, name, price, qty, aftersalable_qty) VALUES (?,?,?,?,?,?)',
        [it.id, o.id, it.name, it.price, it.qty, it.aftersalableQty]);
    }
  }
}

async function reset() {
  for (const t of ['aftersale_events', 'aftersale_images', 'aftersale_tickets',
    'order_items', 'orders', 'sessions', 'users']) {
    await pool.query(`DROP TABLE IF EXISTS ${t}`);
  }
  for (const ddl of SCHEMA) await pool.query(ddl);
  await seedIfEmpty();
}

async function userCount() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  return n;
}

// ---------- 用户与会话 ----------
async function findUserByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
}
async function findUserByToken(token) {
  const [rows] = await pool.query(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', [token]);
  return rows[0] || null;
}
async function createSession(token, userId) {
  const { now } = require('../utils/clock');
  await pool.query('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)',
    [token, userId, now()]);
}
async function deleteSession(token) {
  await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
}

// ---------- 订单 ----------
async function listCompletedOrdersWithItems(userId) {
  const [orders] = await pool.query(
    "SELECT * FROM orders WHERE user_id = ? AND status = 'COMPLETED' ORDER BY created_at, id",
    [userId]);
  for (const o of orders) {
    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const [usedRows] = await pool.query(
      `SELECT item_id, COALESCE(SUM(qty),0) AS used FROM aftersale_tickets
       WHERE order_id = ? AND status NOT IN ('REJECTED','CLOSED') GROUP BY item_id`, [o.id]);
    const usedMap = Object.fromEntries(usedRows.map(r => [r.item_id, r.used]));
    o.items = items.map(it => ({ ...it, usedQty: usedMap[it.id] || 0 }));
  }
  return orders;
}
async function findOrderItem(orderId, itemId) {
  const [rows] = await pool.query(
    `SELECT i.*, o.user_id AS order_user_id, o.status AS order_status
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE i.order_id = ? AND i.id = ?`, [orderId, itemId]);
  return rows[0] || null;
}

// ---------- 售后单 ----------
const IN_FLIGHT = "status NOT IN ('REJECTED','CLOSED')";

async function usedAftersaleQty(orderId, itemId) {
  const [[{ used }]] = await pool.query(
    `SELECT COALESCE(SUM(qty),0) AS used FROM aftersale_tickets
     WHERE order_id = ? AND item_id = ? AND ${IN_FLIGHT}`, [orderId, itemId]);
  return used;
}

// 数量校验 + 写入放在同一事务内；FOR UPDATE 锁住商品行防止并发超量申请
async function createTicketIfAvailable(data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query(
      'SELECT aftersalable_qty FROM order_items WHERE order_id = ? AND id = ? FOR UPDATE',
      [data.orderId, data.itemId]);
    if (!items.length) { await conn.rollback(); return { ok: false, available: 0 }; }
    const [[{ used }]] = await conn.query(
      `SELECT COALESCE(SUM(qty),0) AS used FROM aftersale_tickets
       WHERE order_id = ? AND item_id = ? AND ${IN_FLIGHT}`, [data.orderId, data.itemId]);
    const available = items[0].aftersalable_qty - used;
    if (data.qty > available) { await conn.rollback(); return { ok: false, available }; }
    const [[{ nextSeq }]] = await conn.query(
      'SELECT COALESCE(MAX(seq),0) + 1 AS nextSeq FROM aftersale_tickets');
    const id = 'AS' + String(nextSeq).padStart(4, '0');
    await conn.query(
      `INSERT INTO aftersale_tickets
       (id, seq, order_id, item_id, user_id, type, reason, qty, description, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, nextSeq, data.orderId, data.itemId, data.userId, data.type, data.reason,
        data.qty, data.description, data.status, data.createdAt, data.createdAt]);
    await conn.commit();
    return { ok: true, id };
  } catch (e) {
    try { await conn.rollback(); } catch (_) { /* 忽略回滚失败 */ }
    throw e;
  } finally {
    conn.release();
  }
}

const TICKET_SELECT = `
  SELECT t.*, i.name AS item_name, i.price, u.name AS user_name
  FROM aftersale_tickets t
  JOIN order_items i ON i.order_id = t.order_id AND i.id = t.item_id
  JOIN users u ON u.id = t.user_id`;

async function findTicketById(id) {
  const [rows] = await pool.query(`${TICKET_SELECT} WHERE t.id = ?`, [id]);
  return rows[0] || null;
}
async function listTickets({ userId, status, type } = {}) {
  const where = [], params = [];
  if (userId) { where.push('t.user_id = ?'); params.push(userId); }
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (type) { where.push('t.type = ?'); params.push(type); }
  const [rows] = await pool.query(
    `${TICKET_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.seq DESC`,
    params);
  return rows;
}
async function setTicketDescription(id, text) {
  const { now } = require('../utils/clock');
  await pool.query('UPDATE aftersale_tickets SET description = ?, updated_at = ? WHERE id = ?',
    [text, now(), id]);
}
const UPDATABLE = ['status', 'refund_amount', 'reship_tracking_no', 'inspect_result'];
async function updateTicket(id, fields) {
  const sets = [], params = [];
  for (const k of UPDATABLE) {
    if (k in fields) { sets.push(`${k} = ?`); params.push(fields[k]); }
  }
  if (!sets.length) return;
  const { now } = require('../utils/clock');
  sets.push('updated_at = ?'); params.push(now(), id);
  await pool.query(`UPDATE aftersale_tickets SET ${sets.join(', ')} WHERE id = ?`, params);
}
async function addTicketImages(id, filenames) {
  const { now } = require('../utils/clock');
  for (const f of filenames) {
    await pool.query(
      'INSERT INTO aftersale_images (ticket_id, filename, created_at) VALUES (?,?,?)',
      [id, f, now()]);
  }
}
async function listTicketImages(id) {
  const [rows] = await pool.query(
    'SELECT filename FROM aftersale_images WHERE ticket_id = ? ORDER BY id', [id]);
  return rows.map(r => r.filename);
}
async function addTicketEvent(id, { operatorName, operatorRole, action, note }) {
  const { now } = require('../utils/clock');
  await pool.query(
    `INSERT INTO aftersale_events (ticket_id, operator_name, operator_role, action, note, created_at)
     VALUES (?,?,?,?,?,?)`,
    [id, operatorName, operatorRole, action, note || '', now()]);
}
async function listTicketEvents(id) {
  const [rows] = await pool.query(
    `SELECT created_at, operator_name, operator_role, action, note
     FROM aftersale_events WHERE ticket_id = ? ORDER BY id`, [id]);
  return rows;
}

async function close() { if (pool) await pool.end(); }

module.exports = {
  init, reset, close, userCount,
  findUserByUsername, findUserByToken, createSession, deleteSession,
  listCompletedOrdersWithItems, findOrderItem,
  usedAftersaleQty, createTicketIfAvailable,
  findTicketById, listTickets, setTicketDescription, updateTicket,
  addTicketImages, listTicketImages, addTicketEvent, listTicketEvents,
};
