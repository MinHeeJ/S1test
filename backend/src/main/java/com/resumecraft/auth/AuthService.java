package com.resumecraft.auth;

import com.resumecraft.common.DomainException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.regex.Pattern;

/** Account validation and persistence; session creation occurs only after signup commits. */
@Service
public class AuthService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
            Pattern.UNICODE_CHARACTER_CLASS);
    private final UserMapper users;
    private final PasswordEncoder passwords;
    private final String missingAccountHash;

    public AuthService(UserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        this.missingAccountHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    /** The DB unique constraint also handles concurrent duplicate signups; no session on rollback. */
    @Transactional
    public Long signup(SignupRequest input) {
        if (input.email() == null || !EMAIL.matcher(input.email()).matches()) {
            throw invalid("email");
        }
        int length = input.nickname() == null ? 0
                : input.nickname().codePointCount(0, input.nickname().length());
        if (length < 2 || length > 12) {
            throw invalid("nickname");
        }
        if (input.password() == null || input.password().codePointCount(0, input.password().length()) < 8) {
            throw invalid("password");
        }
        try {
            return users.insert(input.email(), input.nickname(), passwords.encode(input.password()));
        } catch (DuplicateKeyException error) {
            throw new DomainException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
        }
    }

    /** Missing and incorrect credentials share both the BCrypt work and the same safe rejection. */
    public Long login(LoginRequest input) {
        if (input.email() == null) {
            throw invalid("email");
        }
        if (input.password() == null) {
            throw invalid("password");
        }
        UserRow account = users.findByEmail(input.email());
        boolean matches = passwords.matches(
                input.password(),
                account == null ? missingAccountHash : account.passwordHash()
        );
        if (account == null || !matches) {
            throw unauthenticated();
        }
        return account.id();
    }

    /** Reads only the current account; no account, resume or photo mutation is performed. */
    public CurrentUser currentUser(Long id) {
        UserRow account = users.findById(id);
        if (account == null) {
            throw unauthenticated();
        }
        return new CurrentUser(account.nickname());
    }

    private static DomainException invalid(String field) {
        return new DomainException(HttpStatus.BAD_REQUEST, "400", "입력값을 확인해 주세요.", field);
    }

    private static DomainException unauthenticated() {
        return new DomainException(HttpStatus.UNAUTHORIZED, "401", "이메일 또는 비밀번호를 확인해 주세요.", null);
    }
}
