const express = require('express');
const service = require('../services/aftersale');
const wrap = require('../utils/wrap');
const { authRequired, requireRole } = require('../middleware/auth');

// 消费者接口
const router = express.Router();
router.use(authRequired);

// 我的模拟订单（含每件商品的剩余可售后数量）
router.get('/me/orders', requireRole('consumer'), wrap(async (req, res) => {
  const { getStore } = require('../store');
  const repo = await getStore();
  const orders = await repo.listCompletedOrdersWithItems(req.user.id);
  res.json(orders.map(o => ({
    id: o.id,
    status: o.status,
    createdAt: o.created_at,
    items: o.items.map(it => ({
      id: it.id,
      name: it.name,
      price: it.price,
      qty: it.qty,
      aftersalable: it.aftersalable_qty,
      usedQty: it.usedQty,
    })),
  })));
}));

// 提交售后申请
router.post('/tickets', requireRole('consumer'), wrap(async (req, res) => {
  res.json(await service.createTicket(req.user, req.body));
}));

// 我的售后单
router.get('/my/tickets', requireRole('consumer'), wrap(async (req, res) => {
  res.json(await service.listMyTickets(req.user));
}));

// 补充材料
router.post('/tickets/:id/supplement', requireRole('consumer'), wrap(async (req, res) => {
  res.json(await service.supplementTicket(req.user, req.params.id, req.body));
}));

module.exports = router;
