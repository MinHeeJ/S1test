package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authenticates against persisted BCrypt hashes without changing business data. */
@Service
public class LoginService {
    private final AuthMapper mapper;
    private final PasswordEncoder passwords;
    private final String absentAccountHash;

    public LoginService(AuthMapper mapper, PasswordEncoder passwords) {
        this.mapper = mapper;
        this.passwords = passwords;
        this.absentAccountHash = passwords.encode(UUID.randomUUID().toString());
    }

    /** Uses the same public error and hash verification for unknown and incorrect credentials. */
    @Transactional(readOnly = true)
    public AuthAccount login(LoginRequest request) {
        AuthAccount account = mapper.findByEmail(request.email());
        boolean matches = passwords.matches(
            request.password(), account == null ? absentAccountHash : account.passwordHash());
        if (account == null || !matches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                "이메일 또는 비밀번호를 확인해주세요.", null);
        }
        return account;
    }

    /** Loads the current nickname from the account, never from client-provided session data. */
    @Transactional(readOnly = true)
    public CurrentUser currentUser(String principalId) {
        UUID id;
        try {
            id = UUID.fromString(principalId);
        } catch (IllegalArgumentException error) {
            throw unauthenticated();
        }
        AuthAccount account = mapper.findById(id);
        if (account == null) {
            throw unauthenticated();
        }
        return new CurrentUser(account.nickname());
    }

    private ApiException unauthenticated() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "로그인이 필요합니다.", null);
    }
}
