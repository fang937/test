// 登录失败限流（与 Java 版 LoginRateLimiter 同规则）：同「账号+IP」窗口期内失败达上限即临时锁定
const { ApiError } = require('./api-error');

const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;

const attempts = new Map(); // key -> { windowStart, count }

function check(key) {
  prune();
  const a = attempts.get(key);
  if (a && a.count >= MAX_FAILURES && Date.now() - a.windowStart < WINDOW_MS) {
    const minutes = Math.ceil((WINDOW_MS - (Date.now() - a.windowStart)) / 60000);
    throw new ApiError(429, `失败次数过多，请约 ${minutes} 分钟后再试`);
  }
}

function recordFailure(key) {
  prune();
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.windowStart >= WINDOW_MS) {
    attempts.set(key, { windowStart: now, count: 1 });
  } else {
    a.count++;
  }
}

function reset(key) {
  attempts.delete(key);
}

function prune() {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [k, a] of attempts) {
    if (a.windowStart < cutoff) attempts.delete(k);
  }
}

module.exports = { check, recordFailure, reset };
