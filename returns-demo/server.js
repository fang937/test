// 服装网店退换货处理系统 - 后端入口
const { getStore, driverName } = require('./src/store');
const buildApp = require('./src/app');
const { port } = require('./src/config');

(async () => {
  try {
    await getStore(); // 连接数据库、建表、写入演示数据
    buildApp().listen(port, () => {
      console.log(`服装网店退换货处理系统已启动: http://localhost:${port}`);
      console.log(`数据库驱动: ${driverName()}`);
      console.log('演示账号: xiaolin / xiaomei（消费者）、kefu（客服）、cangguan（仓库），密码均为 123456');
    });
  } catch (e) {
    console.error('启动失败:', e.message);
    process.exit(1);
  }
})();
