const express = require('express');
const path = require('path');
const { ApiError } = require('./utils/api-error');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

function buildApp() {
  const app = express();
  app.use(securityHeaders);
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // 存活探针：检查数据库连通性（公开）
  app.get('/api/health', async (req, res) => {
    try {
      const { getStore } = require('./store');
      const store = await getStore();
      await store.userCount();
      res.json({ status: 'UP', db: require('./config').db.driver });
    } catch (e) {
      res.status(503).json({ status: 'DOWN', error: '数据库不可用' });
    }
  });

  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/consumer'));
  app.use('/api', require('./routes/staff'));

  // API 404
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

  // 统一错误处理：ApiError 按其状态码返回，其余按 500
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!(err instanceof ApiError)) console.error(err);
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: '请求体格式错误' });
    }
    res.status(err.status || 500).json({ error: err.message || '服务器内部错误' });
  });

  return app;
}

module.exports = buildApp;
