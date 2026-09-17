// ---------- 数据仓储契约（换数据库 = 实现同一组方法） ----------
// 业务代码（services/routes）只调用这里列出的方法，不直接写 SQL。
// 接入其他设备的数据库时，只需在 src/store/ 下新增一个适配器文件
// （参考 mysql.js），实现全部方法，并在 store/index.js 的工厂中注册。
// 所有方法均返回 Promise。

const CONTRACT = [
  // 初始化 / 重置
  'init',            // (dbConfig) => 建表 + 空库时写入演示数据
  'reset',           // () => 清空并重建演示数据

  // 用户与会话
  'findUserByUsername', // (username) => user | null（含 password_hash / salt）
  'findUserByToken',    // (token) => user | null
  'createSession',      // (token, userId) => void
  'deleteSession',      // (token) => void

  // 订单
  'listCompletedOrdersWithItems', // (userId) => [order + items]，items 含 usedQty
  'findOrderItem',                // (orderId, itemId) => { ...item, order_user_id, order_status } | null

  // 售后单
  'createTicketIfAvailable', // (data) => { ok:true, id } | { ok:false, available }（含数量校验，事务内完成）
  'findTicketById',          // (id) => ticket 行（join 出 item_name / price / user_name）| null
  'listTickets',             // ({ userId?, status?, type? }) => [ticket 行]
  'setTicketDescription',    // (id, text) => void
  'updateTicket',            // (id, fields) => void（白名单字段）
  'addTicketImages',         // (id, filenames[]) => void
  'listTicketImages',        // (id) => [filename]
  'addTicketEvent',          // (id, { operatorName, operatorRole, action, note }) => void
  'listTicketEvents',        // (id) => [{ created_at, operator_name, operator_role, action, note }]
];

// 仓储方法契约说明（各方法返回的行字段见 docs/DESIGN.md 表结构一节）
module.exports = { CONTRACT };
