// ---------- 售后单状态字典与状态机 ----------
// SUBMITTED          已提交，待客服审核
// MATERIAL_REQUESTED 待消费者补充材料
// RETURN_APPROVED    客服同意退回，等待仓库收货
// RECEIVED           仓库已收货，待验货
// INSPECTED          仓库已验货，待客服给出最终结论
// COMPLETED          售后完成（终态）：退货=模拟退款 / 换货=模拟补发
// REJECTED           已拒绝（终态）

const STATUS = {
  SUBMITTED: '待客服审核',
  MATERIAL_REQUESTED: '待补充材料',
  RETURN_APPROVED: '客服已同意退回',
  RECEIVED: '仓库已收货',
  INSPECTED: '仓库已验货，待结论',
  COMPLETED: '售后完成',
  REJECTED: '已拒绝',
};

// 每个状态允许流转到的后继状态；空数组表示终态
const NEXT = {
  SUBMITTED: ['MATERIAL_REQUESTED', 'RETURN_APPROVED', 'REJECTED'],
  MATERIAL_REQUESTED: ['SUBMITTED'],
  RETURN_APPROVED: ['RECEIVED'],
  RECEIVED: ['INSPECTED'],
  INSPECTED: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

const ROLE_TEXT = {
  consumer: '消费者',
  service: '售后客服',
  warehouse: '仓库人员',
};

function canTransit(from, to) {
  return (NEXT[from] || []).includes(to);
}

module.exports = { STATUS, NEXT, ROLE_TEXT, canTransit };
