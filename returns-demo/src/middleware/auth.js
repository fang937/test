const { getStore } = require('../store');
const { ApiError } = require('../utils/api-error');
const wrap = require('../utils/wrap');

// 登录校验：从 Authorization: Bearer <token> 解析出当前用户挂到 req.user
const authRequired = wrap(async (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new ApiError(401, '请先登录');
  const repo = await getStore();
  const user = await repo.findUserByToken(token);
  if (!user) throw new ApiError(401, '登录已失效，请重新登录');
  req.user = user;
  req.token = token;
  next();
});

// 岗位权限校验：须放在 authRequired 之后
function requireRole(...roles) {
  return wrap(async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, '无权限执行此操作');
    }
    next();
  });
}

module.exports = { authRequired, requireRole };
