// 把 async 路由处理函数的 rejection 转交给 Express 错误中间件
module.exports = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
