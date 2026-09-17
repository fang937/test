package com.demo.returns.dto;

import java.util.List;

public record OrderView(String id, String status, String createdAt, List<ItemView> items) {

    public record ItemView(String id, String name, int price, int qty, int aftersalable, int usedQty) {}
}
