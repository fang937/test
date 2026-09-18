const express = require('express');
const crypto = require('crypto');
const { getStore } = require('../store');
const { ApiError } = require('../utils/api-error');
const { verifyPassword } = require('../utils/password');
const rateLimiter = require('../utils/rate-limiter');
const wrap = require('../utils/wrap');

const router = express.Router();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

router.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const key = (username || '') + '|' + clientIp(req);
  rateLimiter.check(key); // 连续失败达上限时抛 429
  const repo = await getStore();
  const user = username ? await repo.findUserByUsername(String(username)) : null;
  if (!user || !verifyPassword(password || '', user.salt, user.password_hash)) {
    rateLimiter.recordFailure(key);
    throw new ApiError(401, '账号或密码错误');
  }
  rateLimiter.reset(key);
  const token = crypto.randomBytes(16).toString('hex');
  await repo.createSession(token, user.id);
  res.json({ token, id: user.id, name: user.name, role: user.role });
}));

// 登出：销毁服务端会话（幂等）
router.post('/logout', wrap(async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token) {
    const repo = await getStore();
    await repo.deleteSession(token);
  }
  res.json({ ok: true });
}));

// 元信息：状态字典与当前数据库驱动（公开）
router.get('/meta', wrap(async (req, res) => {
  const { STATUS } = require('../state-machine');
  const { driverName } = require('../store');
  res.json({ statuses: STATUS, dbDriver: driverName() });
}));

module.exports = router;
