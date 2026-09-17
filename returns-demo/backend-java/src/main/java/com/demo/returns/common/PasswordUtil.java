package com.demo.returns.common;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/** 口令散列：PBKDF2WithHmacSHA256 + 随机盐；数据库不保存明文密码 */
public final class PasswordUtil {
    private static final int ITERATIONS = 120_000;
    private static final int KEY_BITS = 256;
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordUtil() {}

    public record HashedPassword(String salt, String hash) {}

    public static String randomToken() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public static HashedPassword hash(String password) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return new HashedPassword(HexFormat.of().formatHex(salt), pbkdf2(password, salt));
    }

    public static boolean verify(String password, String saltHex, String expectedHashHex) {
        if (password == null || saltHex == null || expectedHashHex == null) {
            return false;
        }
        byte[] salt = HexFormat.of().parseHex(saltHex);
        byte[] computed = HexFormat.of().parseHex(pbkdf2(password, salt));
        byte[] expected = HexFormat.of().parseHex(expectedHashHex);
        return MessageDigest.isEqual(computed, expected);
    }

    private static String pbkdf2(String password, byte[] salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return HexFormat.of().formatHex(factory.generateSecret(spec).getEncoded());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("口令散列失败", e);
        }
    }
}
