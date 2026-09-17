package com.demo.returns.common;

import com.demo.returns.repository.SessionRepository;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final SessionRepository sessionRepository;

    public WebConfig(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new AuthInterceptor(sessionRepository))
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/login", "/api/meta");
    }
}
