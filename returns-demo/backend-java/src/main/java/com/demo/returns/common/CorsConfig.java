package com.demo.returns.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * 跨域配置：默认同源部署（不放开任何来源）。
 * 前后端分离部署时通过 CORS_ALLOWED_ORIGINS 指定允许的来源，逗号分隔，例如：
 *   CORS_ALLOWED_ORIGINS=https://after.example.com
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter(@Value("${app.cors.allowed-origins:}") String allowedOrigins) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        if (allowedOrigins != null && !allowedOrigins.isBlank()) {
            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOrigins(Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList());
            config.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
            config.setAllowedHeaders(List.of("Content-Type", "Authorization"));
            config.setAllowCredentials(true);
            source.registerCorsConfiguration("/**", config);
        }
        return new CorsFilter(source);
    }
}
