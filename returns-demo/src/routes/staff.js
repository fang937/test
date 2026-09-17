const express = require('express');
const service = require('../services/aftersale');
const wrap = require('../utils/wrap');
const { authRequired, requireRole } = require('../middleware/auth');

// 客服与仓库接口
const router = express.Router();
router.use(authRequired);

// 客服/仓库工作台列表，支持 ?status= &type= 筛选
router.get('/tickets', requireRole('service', 'warehouse'), wrap(async (req, res) => {
  res.json(await service.listStaffTickets({
    status: req.query.status || undefined,
    type: req.query.type || undefined,
  }));
}));

// 售后单详情：所有登录角色可查，但消费者只能看本人单据（服务层校验）
router.get('/tickets/:id', wrap(async (req, res) => {
  res.json(await service.getTicketDetail(req.user, req.params.id));
}));

// 客服审核：要求补充材料 / 同意退回 / 拒绝 / 最终结论
router.post('/tickets/:id/review', requireRole('service'), wrap(async (req, res) => {
  res.json(await service.reviewTicket(req.user, req.params.id, req.body));
}));

// 仓库：登记收货 / 提交验货结果
router.post('/tickets/:id/warehouse', requireRole('warehouse'), wrap(async (req, res) => {
  const { action } = req.body || {};
  if (action === 'RECEIVE') {
    res.json(await service.receiveTicket(req.user, req.params.id, req.body));
  } else if (action === 'INSPECT') {
    res.json(await service.inspectTicket(req.user, req.params.id, req.body));
  } else {
    res.status(400).json({ error: '未知仓库操作' });
  }
}));

module.exports = router;
