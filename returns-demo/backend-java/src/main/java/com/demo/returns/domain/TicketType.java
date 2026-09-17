package com.demo.returns.domain;

/** 售后类型：RETURN 退货 / EXCHANGE 换货 */
public enum TicketType {
    RETURN("退货"),
    EXCHANGE("换货");

    private final String label;

    TicketType(String label) { this.label = label; }

    public String getLabel() { return label; }
}
