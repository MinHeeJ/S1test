package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.persistence.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** Verifies BCrypt credentials without changing any account or resume row. */
@Service
public class LoginService {
    private final UserMapper users;
    private final PasswordEncoder passwords;
    private final String absentAccountHash;

    public LoginService(UserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        this.absentAccountHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    /** Missing accounts also incur BCrypt work and receive the identical public failure. */
    public Long login(LoginInput input) {
        if (input.email() == null || input.password() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "400", "입력값을 확인해 주세요.",
                    input.email() == null ? "email" : "password");
        }
        var account = users.findByEmail(input.email().trim());
        boolean matches = passwords.matches(input.password(),
                account == null ? absentAccountHash : account.passwordHash());
        if (account == null || !matches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "401", "이메일 또는 비밀번호를 확인해 주세요.", null);
        }
        return account.id();
    }
}
