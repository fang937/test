// ---------- 售后业务规则（核心） ----------
// 所有业务校验集中在这里；路由层只做参数解析，仓储层只做数据读写。
const { getStore } = require('../store');
const { ApiError } = require('../utils/api-error');
const { check } = require('../utils/validate');
const { now } = require('../utils/clock');
const { STATUS, ROLE_TEXT, canTransit } = require('../state-machine');

const TYPE_TEXT = { RETURN: '退货', EXCHANGE: '换货' };

function requireNote(note, action) {
  check(note && String(note).trim(), `执行「${action}」必须填写原因或说明`);
}

// 仓储行 -> API 视图（camelCase + timeline + images）
function toView(row, events = [], images = []) {
  return {
    id: row.id,
    orderId: row.order_id,
    itemId: row.item_id,
    itemName: row.item_name,
    price: row.price,
    userId: row.user_id,
    userName: row.user_name,
    type: row.type,
    reason: row.reason,
    qty: row.qty,
    description: row.description || '',
    status: row.status,
    statusText: STATUS[row.status] || row.status,
    refundAmount: row.refund_amount,
    reshipTrackingNo: row.reship_tracking_no,
    inspectResult: row.inspect_result,
    createdAt: row.created_at,
    images,
    timeline: events.map(e => ({
      time: e.created_at,
      operator: `${e.operator_name}（${ROLE_TEXT[e.operator_role] || e.operator_role}）`,
      role: e.operator_role,
      action: e.action,
      note: e.note || '',
    })),
  };
}

async function loadView(id) {
  const repo = await getStore();
  const row = await repo.findTicketById(id);
  if (!row) throw new ApiError(404, '售后单不存在');
  const [events, images] = await Promise.all([
    repo.listTicketEvents(id), repo.listTicketImages(id),
  ]);
  return toView(row, events, images);
}

/** 状态机冲突：请求与当前单据状态不匹配，属客户端状态错误（409），区别于业务规则 400 */
async function transit(ticketId, fromStatus, toStatus, operator, action, note) {
  if (!canTransit(fromStatus, toStatus)) {
    throw new ApiError(409,
      `当前状态「${STATUS[fromStatus]}」不允许执行「${action}」`);
  }
  const repo = await getStore();
  await repo.updateTicket(ticketId, { status: toStatus });
  await repo.addTicketEvent(ticketId, {
    operatorName: operator.name, operatorRole: operator.role, action, note,
  });
}

// ---------- 消费者 ----------
async function createTicket(user, body) {
  const { orderId, itemId, type, reason, qty, description, images } = body || {};
  const repo = await getStore();

  check(['RETURN', 'EXCHANGE'].includes(type), '售后类型必须是退货或换货');
  check(orderId && itemId, '请选择订单商品');
  check(reason && String(reason).trim(), '请填写申请原因');
  check(String(reason).length <= 100, '申请原因不能超过100字');
  check(String(description || '').length <= 500, '补充说明不能超过500字');
  const n = qty;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 99) {
    throw new ApiError(400, '申请数量必须是1-99的整数');
  }
  const imgs = Array.isArray(images) ? images.slice(0, 9).map(String) : [];
  check(imgs.every(f => f.length <= 200), '凭证文件名过长');

  const item = await repo.findOrderItem(orderId, itemId);
  // 规则：只能对本人已完成订单申请售后
  check(item && item.order_user_id === user.id, '只能对本人已完成的订单申请售后');
  check(item.order_status === 'COMPLETED', '该订单尚未完成，不能申请售后');

  // 规则：申请数量不能超过剩余可售后数量（校验与写入在同一事务内完成）
  const { ok, available, id } = await repo.createTicketIfAvailable({
    orderId, itemId, userId: user.id, type,
    reason: String(reason).trim(),
    qty: n,
    description: String(description || ''),
    status: 'SUBMITTED',
    createdAt: now(),
  });
  check(ok, `申请数量超过可售后数量（剩余可申请 ${available} 件）`);

  await repo.addTicketImages(id, imgs);
  await repo.addTicketEvent(id, {
    operatorName: user.name, operatorRole: user.role, action: '提交售后申请',
    note: `${TYPE_TEXT[type]} ${n} 件，原因：${String(reason).trim()}。` +
      `${String(description || '').trim()} 凭证：${imgs.length} 张`,
  });
  return loadView(id);
}

async function supplementTicket(user, ticketId, body) {
  const { description, images } = body || {};
  const repo = await getStore();
  const t = await repo.findTicketById(ticketId);
  if (!t) throw new ApiError(404, '售后单不存在');
  // 规则：只能操作本人的售后单
  check(t.user_id === user.id, '无权操作他人售后单');
  const imgs = Array.isArray(images) ? images.slice(0, 9).map(String) : [];
  check((description && String(description).trim()) || imgs.length, '请补充说明或图片凭证');
  check(String(description || '').length <= 500, '补充说明不能超过500字');

  const newDesc = (t.description ? t.description + '\n' : '') + '[补充] ' + (description || '');
  await repo.setTicketDescription(ticketId, newDesc);
  await repo.addTicketImages(ticketId, imgs);
  await transit(ticketId, t.status, 'SUBMITTED', user, '补充材料',
    `${(description || '').trim()}${imgs.length ? ` 新增凭证 ${imgs.length} 张` : ''}`);
  return loadView(ticketId);
}

async function listMyTickets(user) {
  const repo = await getStore();
  const rows = await repo.listTickets({ userId: user.id });
  return Promise.all(rows.map(async r =>
    toView(r, await repo.listTicketEvents(r.id), await repo.listTicketImages(r.id))));
}

async function getTicketDetail(user, ticketId) {
  const repo = await getStore();
  const t = await repo.findTicketById(ticketId);
  if (!t) throw new ApiError(404, '售后单不存在');
  // 规则：普通消费者不能查看他人订单和售后资料
  check(user.role !== 'consumer' || t.user_id === user.id, '无权查看他人售后单', 403);
  return loadView(ticketId);
}

// ---------- 客服 ----------
async function reviewTicket(user, ticketId, body) {
  const { action, note } = body || {};
  const repo = await getStore();
  const t = await repo.findTicketById(ticketId);
  if (!t) throw new ApiError(404, '售后单不存在');

  if (action === 'REQUEST_MATERIAL') {
    requireNote(note, '要求补充材料');
    await transit(ticketId, t.status, 'MATERIAL_REQUESTED', user, '要求补充材料', String(note).trim());
  } else if (action === 'APPROVE_RETURN') {
    requireNote(note, '同意退回');
    await transit(ticketId, t.status, 'RETURN_APPROVED', user, '同意退回',
      `${String(note).trim()}（请按退回指引寄回商品）`);
  } else if (action === 'REJECT') {
    requireNote(note, '拒绝申请');
    await transit(ticketId, t.status, 'REJECTED', user, '拒绝申请', String(note).trim());
  } else if (action === 'FINAL_APPROVE') {
    requireNote(note, '给出最终结论');
    if (t.status !== 'INSPECTED') {
      throw new ApiError(409, '需先完成仓库验货，才能给出最终结论');
    }
    let extra;
    if (t.type === 'RETURN') {
      // 模拟退款：不接真实资金
      const amount = t.price * t.qty;
      await repo.updateTicket(ticketId, { refund_amount: amount });
      extra = `模拟退款完成，退款金额 ￥${amount}（模拟，不接真实资金）。`;
    } else {
      // 换货：记录模拟补发单号
      const trackingNo = 'SF' + Date.now();
      await repo.updateTicket(ticketId, { reship_tracking_no: trackingNo });
      extra = `已安排换货补发，模拟补发单号 ${trackingNo}。`;
    }
    await repo.updateTicket(ticketId, { status: 'COMPLETED' });
    await repo.addTicketEvent(ticketId, {
      operatorName: user.name, operatorRole: user.role,
      action: t.type === 'RETURN' ? '模拟退款完成' : '安排换货补发',
      note: extra + String(note).trim(),
    });
  } else {
    throw new ApiError(400, '未知审核操作');
  }
  return loadView(ticketId);
}

// ---------- 仓库 ----------
async function receiveTicket(user, ticketId, body) {
  const { note } = body || {};
  // 规则：客服同意退回后，仓库才能登记收货（状态冲突 409）
  await transitChecked(user, ticketId, 'RETURN_APPROVED', 'RECEIVED', '登记收到退回包裹',
    String(note || '').trim(), '客服尚未同意退回，不能提前登记收货', 409);
  return loadView(ticketId);
}

async function inspectTicket(user, ticketId, body) {
  const { inspectResult, note } = body || {};
  const repo = await getStore();
  const t = await repo.findTicketById(ticketId);
  if (!t) throw new ApiError(404, '售后单不存在');
  check(['OK', 'PROBLEM'].includes(inspectResult), '请选择验货结果：通过或异常');
  // 规则：验货异常必须填写原因
  check(inspectResult !== 'PROBLEM' || (note && String(note).trim()),
    '验货异常必须填写原因说明');
  await transit(ticketId, t.status, 'INSPECTED', user,
    inspectResult === 'OK' ? '验货通过' : '验货异常',
    String(note || '').trim() || '商品与申请一致');
  await repo.updateTicket(ticketId, { inspect_result: inspectResult });
  return loadView(ticketId);
}

async function transitChecked(user, ticketId, fromStatus, toStatus, action, note, failMsg, status = 400) {
  const repo = await getStore();
  const t = await repo.findTicketById(ticketId);
  if (!t) throw new ApiError(404, '售后单不存在');
  if (t.status !== fromStatus) throw new ApiError(status, failMsg);
  await transit(ticketId, t.status, toStatus, user, action, note);
}

// ---------- 客服/仓库列表 ----------
async function listStaffTickets(filters) {
  const repo = await getStore();
  const rows = await repo.listTickets(filters);
  return Promise.all(rows.map(async r =>
    toView(r, await repo.listTicketEvents(r.id), await repo.listTicketImages(r.id))));
}

module.exports = {
  createTicket, supplementTicket, listMyTickets, getTicketDetail,
  reviewTicket, receiveTicket, inspectTicket, listStaffTickets,
  toView,
};
