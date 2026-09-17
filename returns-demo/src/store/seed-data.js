// 演示种子数据：两个适配器共用；密码在写入前统一做 scrypt 哈希
module.exports = {
  users: [
    { id: 'u1', username: 'xiaolin', password: '123456', name: '小林', role: 'consumer' },
    { id: 'u2', username: 'xiaomei', password: '123456', name: '小美', role: 'consumer' },
    { id: 'u3', username: 'kefu', password: '123456', name: '客服阿强', role: 'service' },
    { id: 'u4', username: 'cangguan', password: '123456', name: '仓管老王', role: 'warehouse' },
  ],
  orders: [
    {
      id: 'O2026091001', userId: 'u1', status: 'COMPLETED', createdAt: '2026-09-10 10:00:00',
      items: [
        { id: 'i1', name: '白色长袖衬衫（M码）', price: 129, qty: 1, aftersalableQty: 1 },
        { id: 'i2', name: '白色长袖衬衫（L码）', price: 129, qty: 1, aftersalableQty: 1 },
        { id: 'i3', name: '黑色休闲裤（30码）', price: 159, qty: 2, aftersalableQty: 2 },
      ],
    },
    {
      id: 'O2026090502', userId: 'u2', status: 'COMPLETED', createdAt: '2026-09-05 15:30:00',
      items: [
        { id: 'i4', name: '牛仔外套', price: 259, qty: 1, aftersalableQty: 1 },
      ],
    },
  ],
};
