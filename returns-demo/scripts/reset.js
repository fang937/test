// 重置演示数据：清空并重建（数据库类型跟随 DB_DRIVER 环境变量）
const { resetStore, driverName } = require('../src/store');

resetStore()
  .then(() => { console.log(`演示数据已重置（驱动: ${driverName()}）`); process.exit(0); })
  .catch(e => { console.error('重置失败:', e.message); process.exit(1); });
