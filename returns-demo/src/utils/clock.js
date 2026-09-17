// 统一的时间格式：入库与展示使用同一格式
function now() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}
module.exports = { now };
