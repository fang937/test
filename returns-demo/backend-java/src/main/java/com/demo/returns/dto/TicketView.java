package com.demo.returns.dto;

import java.util.List;

/** 售后单视图：字段与前端约定一致（camelCase + images + timeline） */
public record TicketView(
        String id,
        String orderId,
        String itemId,
        String itemName,
        int price,
        String userId,
        String userName,
        String type,
        String reason,
        int qty,
        String description,
        String status,
        String statusText,
        Integer refundAmount,
        String reshipTrackingNo,
        String inspectResult,
        String createdAt,
        List<String> images,
        List<TimelineEntry> timeline) {

    public record TimelineEntry(String time, String operator, String role, String action, String note) {}
}
