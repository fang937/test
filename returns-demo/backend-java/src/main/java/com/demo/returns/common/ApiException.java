package com.demo.returns.common;

/** 业务异常：status 作为 HTTP 状态码返回 */
public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() { return status; }

    public static ApiException badRequest(String message) { return new ApiException(400, message); }
    public static ApiException unauthorized(String message) { return new ApiException(401, message); }
    public static ApiException forbidden(String message) { return new ApiException(403, message); }
    public static ApiException notFound(String message) { return new ApiException(404, message); }
}
