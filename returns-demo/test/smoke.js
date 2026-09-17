// 冒烟测试：覆盖需求文档「核心验收场景」的正常 / 异常 / 越权情况
// 运行：npm run smoke —— 启动本地 Node 参照实现并测试（独立 data/smoke.db）
//      SMOKE_BASE_URL=http://127.0.0.1:3000 node test/smoke.js —— 测试已运行的后端（如 Java 版）
const EXTERNAL = process.env.SMOKE_BASE_URL;
if (!EXTERNAL) {
  process.env.DB_DRIVER = 'sqlite';
  process.env.DB_FILE = require('path').join(__dirname, '..', 'data', 'smoke.db');
}

(async () => {
  const fs = require('fs');
  let store = null, server = null;
  let base;
  if (EXTERNAL) {
    base = EXTERNAL.replace(/\/$/, '');
    console.log(`— 目标后端: ${EXTERNAL} —`);
  } else {
    fs.rmSync(process.env.DB_FILE, { force: true });
    const { getStore } = require('../src/store');
    store = await getStore();
    const buildApp = require('../src/app');
    server = buildApp().listen(0);
    base = 'http://127.0.0.1:' + server.address().port;
  }

  let passed = 0, failed = 0;
  const ok = (cond, name, extra) => {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.log('  ✗ ' + name + (extra ? ` —— ${extra}` : '')); }
  };
  const call = async (method, path, { token, body } = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };

  console.log('— 登录与会话 —');
  const badLogin = await call('POST', '/api/login', { body: { username: 'xiaolin', password: 'wrong' } });
  ok(badLogin.status === 401, '错误密码登录被拒绝(401)');
  const lin = await call('POST', '/api/login', { body: { username: 'xiaolin', password: '123456' } });
  const mei = await call('POST', '/api/login', { body: { username: 'xiaomei', password: '123456' } });
  const kefu = await call('POST', '/api/login', { body: { username: 'kefu', password: '123456' } });
  const cang = await call('POST', '/api/login', { body: { username: 'cangguan', password: '123456' } });
  ok(lin.status === 200 && lin.data.token, '消费者小林登录');
  ok(kefu.data.role === 'service' && cang.data.role === 'warehouse', '客服/仓库账号角色正确');
  const anon = await call('GET', '/api/me/orders');
  ok(anon.status === 401, '未登录访问接口被拒绝(401)');

  console.log('— 订单与申请规则 —');
  const orders = await call('GET', '/api/me/orders', { token: lin.data.token });
  ok(orders.status === 200 && orders.data.length === 1 && orders.data[0].items.length === 3,
    '小林可见本人1个已完成订单（3件商品）');
  const cross = await call('POST', '/api/tickets', { token: mei.data.token,
    body: { orderId: 'O2026091001', itemId: 'i1', type: 'RETURN', reason: '质量问题', qty: 1 } });
  ok(cross.status === 400, '不能对他人订单申请售后(400)');
  const over = await call('POST', '/api/tickets', { token: lin.data.token,
    body: { orderId: 'O2026091001', itemId: 'i3', type: 'RETURN', reason: '质量问题', qty: 3 } });
  ok(over.status === 400 && String(over.data.error).includes('超过可售后数量'), '申请数量超过可售后数量被拒绝');
  const t1 = await call('POST', '/api/tickets', { token: lin.data.token,
    body: { orderId: 'O2026091001', itemId: 'i1', type: 'EXCHANGE', reason: '尺码不合适',
      qty: 1, description: 'M码偏小', images: ['凭证图1.jpg'] } });
  ok(t1.status === 200 && t1.data.id === 'AS0001' && t1.data.status === 'SUBMITTED', '提交换货申请 AS0001');
  const dup = await call('POST', '/api/tickets', { token: lin.data.token,
    body: { orderId: 'O2026091001', itemId: 'i1', type: 'RETURN', reason: '不想要了', qty: 1 } });
  ok(dup.status === 400, '同一商品重复申请被拒绝（剩余可售后数量为0）');

  console.log('— 权限与状态机 —');
  const early = await call('POST', '/api/tickets/AS0001/warehouse', { token: cang.data.token,
    body: { action: 'RECEIVE' } });
  ok(early.status === 400 && String(early.data.error).includes('尚未同意退回'), '客服同意退回前仓库不能登记收货');
  const peek = await call('GET', '/api/tickets/AS0001', { token: mei.data.token });
  ok(peek.status === 403, '消费者不能查看他人售后单(403)');
  const staffListAsConsumer = await call('GET', '/api/tickets', { token: lin.data.token });
  ok(staffListAsConsumer.status === 403, '消费者不能访问客服/仓库工作台列表(403)');
  const selfReview = await call('POST', '/api/tickets/AS0001/review', { token: lin.data.token,
    body: { action: 'APPROVE_RETURN', note: 'x' } });
  ok(selfReview.status === 403, '消费者不能执行客服审核(403)');
  const noNote = await call('POST', '/api/tickets/AS0001/review', { token: kefu.data.token,
    body: { action: 'APPROVE_RETURN', note: '' } });
  ok(noNote.status === 400, '审核不填原因被拒绝');

  console.log('— 补充材料与换货全流程 —');
  const req1 = await call('POST', '/api/tickets/AS0001/review', { token: kefu.data.token,
    body: { action: 'REQUEST_MATERIAL', note: '请补充商品整体照片' } });
  ok(req1.status === 200 && req1.data.status === 'MATERIAL_REQUESTED', '客服要求补充材料');
  const sup1 = await call('POST', '/api/tickets/AS0001/supplement', { token: lin.data.token,
    body: { description: '已上传整体照片', images: ['补充图1.jpg'] } });
  ok(sup1.status === 200 && sup1.data.status === 'SUBMITTED' && sup1.data.images.length === 2,
    '消费者补充材料后重新进入审核');
  const appr = await call('POST', '/api/tickets/AS0001/review', { token: kefu.data.token,
    body: { action: 'APPROVE_RETURN', note: '在售后期内，同意退回' } });
  ok(appr.status === 200 && appr.data.status === 'RETURN_APPROVED', '客服同意退回');
  const recv = await call('POST', '/api/tickets/AS0001/warehouse', { token: cang.data.token,
    body: { action: 'RECEIVE', note: '收到退回包裹' } });
  ok(recv.status === 200 && recv.data.status === 'RECEIVED', '仓库登记收货');
  const insBad = await call('POST', '/api/tickets/AS0001/warehouse', { token: cang.data.token,
    body: { action: 'INSPECT', inspectResult: 'PROBLEM' } });
  ok(insBad.status === 400, '验货异常不填原因被拒绝');
  const ins = await call('POST', '/api/tickets/AS0001/warehouse', { token: cang.data.token,
    body: { action: 'INSPECT', inspectResult: 'OK' } });
  ok(ins.status === 200 && ins.data.status === 'INSPECTED', '仓库提交验货通过');
  const fin = await call('POST', '/api/tickets/AS0001/review', { token: kefu.data.token,
    body: { action: 'FINAL_APPROVE', note: '验货通过，安排补发' } });
  ok(fin.status === 200 && fin.data.status === 'COMPLETED' && /^SF\d+$/.test(fin.data.reshipTrackingNo || ''),
    '换货完成并生成模拟补发单号');
  ok((fin.data.timeline || []).length >= 7, '时间线完整记录每次状态变化（岗位+时间+说明）');

  console.log('— 退货流程与验货异常处理 —');
  const t2 = await call('POST', '/api/tickets', { token: lin.data.token,
    body: { orderId: 'O2026091001', itemId: 'i2', type: 'RETURN', reason: '商品质量问题', qty: 1 } });
  ok(t2.status === 200 && t2.data.id === 'AS0002', '提交退货申请 AS0002');
  await call('POST', '/api/tickets/AS0002/review', { token: kefu.data.token,
    body: { action: 'APPROVE_RETURN', note: '同意退回' } });
  await call('POST', '/api/tickets/AS0002/warehouse', { token: cang.data.token,
    body: { action: 'RECEIVE' } });
  const ins2 = await call('POST', '/api/tickets/AS0002/warehouse', { token: cang.data.token,
    body: { action: 'INSPECT', inspectResult: 'PROBLEM', note: '商品吊牌缺失，影响二次销售' } });
  ok(ins2.status === 200 && ins2.data.inspectResult === 'PROBLEM', '验货异常已登记原因');
  const rej = await call('POST', '/api/tickets/AS0002/review', { token: kefu.data.token,
    body: { action: 'REJECT', note: '验货发现吊牌缺失，不符合退货条件' } });
  ok(rej.status === 200 && rej.data.status === 'REJECTED', '验货异常后客服拒绝并留下结论');

  console.log('— 退货完成与模拟退款 —');
  const t3 = await call('POST', '/api/tickets', { token: lin.data.token,
    body: { orderId: 'O2026091001', itemId: 'i2', type: 'RETURN', reason: '再次申请', qty: 1 } });
  ok(t3.status === 200 && t3.data.id === 'AS0003', '拒绝后可售后数量释放，可再次申请 AS0003');
  await call('POST', '/api/tickets/AS0003/review', { token: kefu.data.token,
    body: { action: 'APPROVE_RETURN', note: '同意' } });
  await call('POST', '/api/tickets/AS0003/warehouse', { token: cang.data.token,
    body: { action: 'RECEIVE' } });
  await call('POST', '/api/tickets/AS0003/warehouse', { token: cang.data.token,
    body: { action: 'INSPECT', inspectResult: 'OK' } });
  const refund = await call('POST', '/api/tickets/AS0003/review', { token: kefu.data.token,
    body: { action: 'FINAL_APPROVE', note: '验货无误' } });
  ok(refund.status === 200 && refund.data.status === 'COMPLETED' && refund.data.refundAmount === 129,
    '退货完成并记录模拟退款金额 ￥129');

  console.log('— 列表筛选与登出 —');
  const done = await call('GET', '/api/tickets?status=COMPLETED', { token: kefu.data.token });
  ok(done.status === 200 && done.data.length === 2, '客服工作台按状态筛选（已完成2单）');
  const myList = await call('GET', '/api/my/tickets', { token: lin.data.token });
  ok(myList.status === 200 && myList.data.length === 3, '消费者可见本人3张售后单');
  await call('POST', '/api/logout', { token: lin.data.token });
  const afterLogout = await call('GET', '/api/me/orders', { token: lin.data.token });
  ok(afterLogout.status === 401, '登出后 token 失效');

  console.log(`\n冒烟测试结果: ${passed} 通过, ${failed} 失败`);
  if (server) server.close();
  if (store) await store.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
