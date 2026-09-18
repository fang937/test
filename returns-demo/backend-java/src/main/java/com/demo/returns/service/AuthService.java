package com.demo.returns.service;

import com.demo.returns.common.ApiException;
import com.demo.returns.common.LoginRateLimiter;
import com.demo.returns.common.PasswordUtil;
import com.demo.returns.dto.LoginResponse;
import com.demo.returns.entity.SessionEntity;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.repository.SessionRepository;
import com.demo.returns.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final LoginRateLimiter rateLimiter;

    public AuthService(UserRepository userRepository, SessionRepository sessionRepository,
                       LoginRateLimiter rateLimiter) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.rateLimiter = rateLimiter;
    }

    @Transactional
    public LoginResponse login(String username, String password, String clientIp) {
        String key = (username == null ? "" : username) + "|" + clientIp;
        rateLimiter.check(key); // 连续失败达上限时抛 429
        UserEntity user = username == null ? null
                : userRepository.findByUsername(username).orElse(null);
        if (user == null || !PasswordUtil.verify(password, user.getSalt(), user.getPasswordHash())) {
            rateLimiter.recordFailure(key);
            throw ApiException.unauthorized("账号或密码错误");
        }
        rateLimiter.reset(key);
        String token = PasswordUtil.randomToken();
        sessionRepository.save(new SessionEntity(token, user, LocalDateTime.now()));
        return new LoginResponse(token, user.getId(), user.getName(), user.getRole().getCode());
    }

    @Transactional
    public void logout(String token) {
        if (token != null && !token.isBlank()) {
            sessionRepository.deleteById(token);
        }
    }

    /** 每小时清理超过有效期（7 天）未活动的会话 */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    @Transactional
    public void cleanExpiredSessions() {
        int removed = sessionRepository.deleteExpiredBefore(
                LocalDateTime.now().minus(SessionRepository.SESSION_TTL));
        if (removed > 0) {
            log.info("已清理过期会话 {} 条", removed);
        }
    }
}
