package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** Verifies BCrypt without modifying account rows or exposing whether an email exists. */
@Service
public class LoginService {
    private final AuthUserMapper users;
    private final PasswordEncoder passwords;
    private final String absentAccountHash;

    public LoginService(AuthUserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        this.absentAccountHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    /** Both unknown email and wrong password produce the same safe credential failure. */
    public SessionUser login(LoginInput input) {
        if (input.email() == null || input.password() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "입력값을 확인해 주세요.",
                    input.email() == null ? "email" : "password");
        }
        var account = users.findByEmail(input.email().trim());
        boolean matches = passwords.matches(input.password(),
                account == null ? absentAccountHash : account.passwordHash());
        if (account == null || !matches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_STRUCTURE",
                    "이메일 또는 비밀번호를 확인해 주세요.", null);
        }
        return account.sessionUser();
    }
}
