// ---------- 数据库适配器工厂 ----------
// 业务代码统一通过 getStore() 取得仓储实例，不关心底层是哪种数据库。
// 切换方式（见 docs/DESIGN.md「数据库切换」一节）：
//   DB_DRIVER=sqlite                         使用本地 SQLite 文件（默认）
//   DB_DRIVER=mysql DB_HOST=<设备IP> ...      使用其他设备上的 MySQL
// 新增 PostgreSQL 等其他数据库：在 src/store/ 下实现 contract.js 的方法，
// 然后在 createAdapter 中注册即可，业务代码零改动。
const config = require('../config');
const { CONTRACT } = require('./contract');

let instance = null;

function createAdapter(driver) {
  if (driver === 'sqlite') return require('./sqlite');
  if (driver === 'mysql') return require('./mysql');
  throw new Error(`未知 DB_DRIVER: ${driver}（当前支持 sqlite / mysql）`);
}

async function getStore() {
  if (instance) return instance;
  const adapter = createAdapter(config.db.driver);
  await adapter.init(config.db);
  // 启动即校验适配器实现了完整契约，避免到运行期才发现缺方法
  const missing = CONTRACT.filter(m => typeof adapter[m] !== 'function');
  if (missing.length) {
    throw new Error(`数据库适配器 ${config.db.driver} 未实现仓储方法: ${missing.join(', ')}`);
  }
  instance = adapter;
  return instance;
}

async function resetStore() {
  const store = await getStore();
  await store.reset();
}

module.exports = { getStore, resetStore, driverName: () => config.db.driver };
