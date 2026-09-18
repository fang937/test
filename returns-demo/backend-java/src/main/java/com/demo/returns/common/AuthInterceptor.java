package com.demo.returns.common;

import com.demo.returns.domain.Role;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.repository.SessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalDateTime;

/** Bearer token 认证 + @RequireRole 岗位校验；当前用户写入 request attribute "user" */
public class AuthInterceptor implements HandlerInterceptor {
    public static final String USER_ATTR = "user";

    private final SessionRepository sessionRepository;

    public AuthInterceptor(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true; // 静态资源等非 Controller 处理
        }
        // 只有规范的 "Bearer <token>" 才视为携带令牌，其余一律当作未登录
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        String token = null;
        if (header != null && header.toLowerCase().startsWith("bearer ")) {
            token = header.substring(7).trim();
        }
        UserEntity user = (token == null || token.isBlank()) ? null
                : sessionRepository
                        .findActiveUserByToken(token, LocalDateTime.now().minus(SessionRepository.SESSION_TTL))
                        .orElse(null);
        if (user != null) {
            request.setAttribute(USER_ATTR, user);
        }

        RequireRole required = handlerMethod.getMethodAnnotation(RequireRole.class);
        if (required == null) {
            required = handlerMethod.getBeanType().getAnnotation(RequireRole.class);
        }
        if (required == null) {
            return true; // 该接口不强制登录
        }
        if (user == null) {
            throw ApiException.unauthorized(token == null ? "请先登录" : "登录已失效，请重新登录");
        }
        for (String code : required.value()) {
            if (Role.valueOf(code.toUpperCase()).getCode().equals(user.getRole().getCode())) {
                return true;
            }
        }
        throw ApiException.forbidden("无权限执行此操作");
    }
}
