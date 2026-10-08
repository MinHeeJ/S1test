package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionUser;
import com.resumecraft.common.persistence.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** Verifies BCrypt credentials without mutating account rows or revealing account existence. */
@Service
public class LoginService {
    private final UserMapper users;
    private final PasswordEncoder passwords;
    private final String unavailableHash;

    public LoginService(UserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        this.unavailableHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    /** Missing wire fields are input errors; all credential mismatches share one 401 envelope. */
    public SessionUser login(LoginInput input) {
        if (input.email() == null || input.password() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Bad Request", "Bad Request",
                input.email() == null ? "email" : "password");
        }
        var row = users.findByEmail(input.email());
        boolean matches = passwords.matches(input.password(), row == null ? unavailableHash : row.passwordHash());
        if (row == null || !matches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Unauthorized", null);
        }
        return new SessionUser(row.id(), row.email(), row.nickname());
    }
}
