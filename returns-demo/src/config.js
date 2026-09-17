const path = require('path');

function intOr(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
const env = process.env;

// 通过环境变量切换运行环境与数据库；默认使用本地 SQLite 文件库
module.exports = {
  port: intOr(env.PORT, 3000),
  db: {
    driver: (env.DB_DRIVER || 'sqlite').toLowerCase(), // sqlite | mysql
    file: env.DB_FILE || path.join(__dirname, '..', 'data', 'aftersale.db'),
    host: env.DB_HOST || '127.0.0.1',
    port: intOr(env.DB_PORT, 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'returns_demo',
  },
};
