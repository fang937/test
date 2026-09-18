package com.demo.returns.common;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 登录失败限流（单实例内存版）：同一「账号+来源IP」在窗口期内连续失败达到上限后临时锁定，
 * 防止在线爆破密码。多实例部署时需换 Redis 等共享存储（见 docs/DEPLOY.md 已知差距）。
 */
@Component
public class LoginRateLimiter {

    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(10);

    private final ConcurrentHashMap<String, Attempt> attempts = new ConcurrentHashMap<>();

    private static final class Attempt {
        final Instant windowStart = Instant.now();
        volatile int count;
    }

    /** 达到锁定阈值且仍在锁定期内时抛 429 */
    public void check(String key) {
        prune();
        Attempt a = attempts.get(key);
        if (a == null) {
            return;
        }
        synchronized (a) {
            if (a.count >= MAX_FAILURES && Instant.now().isBefore(a.windowStart.plus(WINDOW))) {
                long minutes = Duration.between(Instant.now(), a.windowStart.plus(WINDOW)).toMinutes() + 1;
                throw new ApiException(429, "失败次数过多，请约 " + minutes + " 分钟后再试");
            }
        }
    }

    public void recordFailure(String key) {
        prune();
        attempts.compute(key, (k, old) -> {
            if (old == null || Duration.between(old.windowStart, Instant.now()).compareTo(WINDOW) > 0) {
                Attempt fresh = new Attempt();
                fresh.count = 1;
                return fresh;
            }
            old.count++;
            return old;
        });
    }

    public void reset(String key) {
        attempts.remove(key);
    }

    /** 清理早已过期的记录，避免内存缓慢增长 */
    private void prune() {
        Instant cutoff = Instant.now().minus(WINDOW.multipliedBy(2));
        attempts.values().removeIf(a -> a.windowStart.isBefore(cutoff));
    }
}
