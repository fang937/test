package com.demo.returns.domain;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * 售后单状态机：每个状态定义了允许流转到的后继状态。
 * COMPLETED / REJECTED 为终态。
 */
public enum AftersaleStatus {
    SUBMITTED("待客服审核"),
    MATERIAL_REQUESTED("待补充材料"),
    RETURN_APPROVED("客服已同意退回"),
    RECEIVED("仓库已收货"),
    INSPECTED("仓库已验货，待结论"),
    COMPLETED("售后完成"),
    REJECTED("已拒绝");

    private final String label;

    AftersaleStatus(String label) { this.label = label; }

    public String getLabel() { return label; }

    private static final Map<AftersaleStatus, Set<AftersaleStatus>> NEXT = Map.of(
            SUBMITTED, EnumSet.of(MATERIAL_REQUESTED, RETURN_APPROVED, REJECTED),
            MATERIAL_REQUESTED, EnumSet.of(SUBMITTED),
            RETURN_APPROVED, EnumSet.of(RECEIVED),
            RECEIVED, EnumSet.of(INSPECTED),
            INSPECTED, EnumSet.of(COMPLETED, REJECTED),
            COMPLETED, EnumSet.noneOf(AftersaleStatus.class),
            REJECTED, EnumSet.noneOf(AftersaleStatus.class));

    public boolean canTransitTo(AftersaleStatus target) {
        return NEXT.get(this).contains(target);
    }
}
