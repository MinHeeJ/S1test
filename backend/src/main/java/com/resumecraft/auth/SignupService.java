package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.persistence.UserMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Validates and commits an account before the controller establishes its session. */
@Service
public class SignupService {
    private final UserMapper users;
    private final PasswordEncoder passwords;

    public SignupService(UserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    /** Unique email is enforced both here and by the database for racing registrations. */
    @Transactional
    public Long signup(SignupInput input) {
        String email = input.email() == null ? "" : input.email().trim();
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw invalid("email");
        }
        if (length(input.nickname()) < 2 || length(input.nickname()) > 12) {
            throw invalid("nickname");
        }
        if (length(input.password()) < 8) {
            throw invalid("password");
        }
        if (users.findByEmail(email) != null) {
            throw duplicate();
        }
        try {
            return users.insert(email, input.nickname(), passwords.encode(input.password()));
        } catch (DuplicateKeyException error) {
            throw duplicate();
        }
    }

    private static int length(String value) {
        return value == null ? 0 : value.codePointCount(0, value.length());
    }

    private static ApiException invalid(String field) {
        return new ApiException(HttpStatus.BAD_REQUEST, "400", "입력값을 확인해 주세요.", field);
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
    }
}
