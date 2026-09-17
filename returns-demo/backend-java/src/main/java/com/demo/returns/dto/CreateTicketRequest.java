package com.demo.returns.dto;

import java.util.List;

public record CreateTicketRequest(String orderId, String itemId, String type, String reason,
                                  Integer qty, String description, List<String> images) {}
