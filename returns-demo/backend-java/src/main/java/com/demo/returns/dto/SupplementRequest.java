package com.demo.returns.dto;

import java.util.List;

public record SupplementRequest(String description, List<String> images) {}
