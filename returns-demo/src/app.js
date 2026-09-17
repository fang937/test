const express = require('express');
const path = require('path');
const { ApiError } = require('./utils/api-error');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/consumer'));
  app.use('/api', require('./routes/staff'));

  // API 404
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

  // 统一错误处理：ApiError 按其状态码返回，其余按 500
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!(err instanceof ApiError)) console.error(err);
    res.status(err.status || 500).json({ error: err.message || '服务器内部错误' });
  });

  return app;
}

module.exports = buildApp;
