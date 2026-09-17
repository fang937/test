package com.demo.returns.domain;

/** 岗位角色；code 为 API 与前端约定的取值 */
public enum Role {
    CONSUMER("consumer", "消费者"),
    SERVICE("service", "售后客服"),
    WAREHOUSE("warehouse", "仓库人员");

    private final String code;
    private final String label;

    Role(String code, String label) { this.code = code; this.label = label; }

    public String getCode() { return code; }
    public String getLabel() { return label; }
}
