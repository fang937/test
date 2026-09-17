package com.demo.returns.controller;

import com.demo.returns.common.AuthInterceptor;
import com.demo.returns.common.RequireRole;
import com.demo.returns.dto.LoginRequest;
import com.demo.returns.dto.LoginResponse;
import com.demo.returns.dto.MetaResponse;
import com.demo.returns.domain.AftersaleStatus;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;
    private final String dbDriver;

    public AuthController(AuthService authService, @Value("${app.db-driver}") String dbDriver) {
        this.authService = authService;
        this.dbDriver = dbDriver;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request.username(), request.password());
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(@org.springframework.web.bind.annotation.RequestAttribute(
            value = AuthInterceptor.USER_ATTR, required = false) UserEntity user,
            HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null) {
            authService.logout(authorization.replaceFirst("(?i)^Bearer\\s+", ""));
        }
        return Map.of("ok", true);
    }

    @GetMapping("/meta")
    public MetaResponse meta() {
        Map<String, String> statuses = new LinkedHashMap<>();
        Arrays.stream(AftersaleStatus.values())
                .forEach(s -> statuses.put(s.name(), s.getLabel()));
        return new MetaResponse(statuses, dbDriver);
    }
}
