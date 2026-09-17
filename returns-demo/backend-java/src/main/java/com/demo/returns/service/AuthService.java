package com.demo.returns.service;

import com.demo.returns.common.ApiException;
import com.demo.returns.common.PasswordUtil;
import com.demo.returns.dto.LoginResponse;
import com.demo.returns.entity.SessionEntity;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.repository.SessionRepository;
import com.demo.returns.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;

    public AuthService(UserRepository userRepository, SessionRepository sessionRepository) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional
    public LoginResponse login(String username, String password) {
        UserEntity user = username == null ? null
                : userRepository.findByUsername(username).orElse(null);
        if (user == null || !PasswordUtil.verify(password, user.getSalt(), user.getPasswordHash())) {
            throw ApiException.unauthorized("账号或密码错误");
        }
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
}
