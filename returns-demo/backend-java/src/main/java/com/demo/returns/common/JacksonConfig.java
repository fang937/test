package com.demo.returns.common;

import com.fasterxml.jackson.databind.cfg.CoercionAction;
import com.fasterxml.jackson.databind.cfg.CoercionInputShape;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    /** 整数字段（如申请数量）不接受 JSON 字符串（"1"），防止类型被静默转换 */
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer strictNumbers() {
        return builder -> builder.postConfigurer(mapper ->
                mapper.coercionConfigFor(Integer.class)
                        .setCoercion(CoercionInputShape.String, CoercionAction.Fail));
    }
}
