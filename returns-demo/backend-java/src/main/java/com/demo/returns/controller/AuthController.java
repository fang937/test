package com.demo.returns.controller;

import com.demo.returns.common.AuthInterceptor;
import com.demo.returns.common.RequireRole;
import com.demo.returns.dto.LoginRequest;
import com.demo.returns.dto.LoginResponse;
import com.demo.returns.dto.MetaResponse;
import com.demo.returns.domain.AftersaleStatus;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.repository.UserRepository;
import com.demo.returns.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final String dbDriver;

    public AuthController(AuthService authService, UserRepository userRepository,
                          @Value("${app.db-driver}") String dbDriver) {
        this.authService = authService;
        this.userRepository = userRepository;
        this.dbDriver = dbDriver;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        return authService.login(request.username(), request.password(), clientIp(httpRequest));
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(@RequestAttribute(
            value = AuthInterceptor.USER_ATTR, required = false) UserEntity user,
            HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null) {
            authService.logout(authorization.replaceFirst("(?i)^Bearer\\s+", ""));
        }
        return Map.of("ok", true);
    }

    /** 元信息：状态字典与当前数据库驱动（公开） */
    @GetMapping("/meta")
    public MetaResponse meta() {
        Map<String, String> statuses = new LinkedHashMap<>();
        Arrays.stream(AftersaleStatus.values())
                .forEach(s -> statuses.put(s.name(), s.getLabel()));
        return new MetaResponse(statuses, dbDriver);
    }

    /** 存活探针：含数据库连通性检查（公开）；供负载均衡 / 容器健康检查使用 */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        try {
            userRepository.count();
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of(
                    "status", "DOWN", "db", dbDriver, "error", "数据库不可用"));
        }
        return ResponseEntity.ok(Map.of("status", "UP", "db", dbDriver));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
