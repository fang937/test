// 业务异常：status 会被错误处理中间件用作 HTTP 状态码
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
module.exports = { ApiError };
