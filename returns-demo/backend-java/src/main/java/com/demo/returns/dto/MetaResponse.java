package com.demo.returns.dto;

import java.util.Map;

public record MetaResponse(Map<String, String> statuses, String dbDriver) {}
