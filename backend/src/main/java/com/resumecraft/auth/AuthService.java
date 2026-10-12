package com.resumecraft.auth;

import com.resumecraft.common.DomainException;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Account persistence and credential checks; HTTP session creation happens after this proxy commits. */
@Service
public class AuthService {
    private final AuthMapper accounts;
    private final PasswordEncoder passwords;
    private final String absentAccountHash;

    public AuthService(AuthMapper accounts, PasswordEncoder passwords) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.absentAccountHash = passwords.encode(UUID.randomUUID().toString());
    }

    /** Unique email enforcement includes concurrent inserts; failed commands never establish a session. */
    @Transactional
    public UUID signup(SignupRequest input) {
        UUID id = UUID.randomUUID();
        try {
            accounts.insert(new AuthAccount(id, input.email(), input.nickname(), passwords.encode(input.password())));
        } catch (DuplicateKeyException exception) {
            throw new DomainException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
        }
        return id;
    }

    /** Absent accounts and wrong passwords produce identical safe errors and both perform BCrypt comparison. */
    @Transactional(readOnly = true)
    public UUID login(LoginRequest input) {
        AuthAccount account = accounts.findByEmail(input.email());
        boolean matches = passwords.matches(
            input.password(), account == null ? absentAccountHash : account.passwordHash());
        if (account == null || !matches) {
            throw unauthorized();
        }
        return account.id();
    }

    /** Always reads the session owner's current nickname from storage without changing any row. */
    @Transactional(readOnly = true)
    public CurrentUser current(UUID id) {
        AuthAccount account = accounts.findById(id);
        if (account == null) {
            throw unauthorized();
        }
        return new CurrentUser(account.nickname());
    }

    private static DomainException unauthorized() {
        return new DomainException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "인증 정보를 확인해 주세요.");
    }
}
