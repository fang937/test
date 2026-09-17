const { ApiError } = require('./api-error');

// 断言工具：条件不满足时抛出带 HTTP 状态码的业务异常
function check(condition, message, status = 400) {
  if (!condition) throw new ApiError(status, message);
}
module.exports = { check };
