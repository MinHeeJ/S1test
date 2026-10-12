package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates an account atomically; the controller starts a session only after commit. */
@Service
public class SignupService {
    private final AuthMapper mapper;
    private final PasswordEncoder passwords;

    public SignupService(AuthMapper mapper, PasswordEncoder passwords) {
        this.mapper = mapper;
        this.passwords = passwords;
    }

    /** The database unique constraint also rejects racing signups with the same email. */
    @Transactional
    public AuthAccount signup(SignupRequest request) {
        if (mapper.findByEmail(request.email()) != null) {
            throw duplicateEmail();
        }
        AuthAccount account = new AuthAccount(UUID.randomUUID(), request.email(), request.nickname(),
            passwords.encode(request.password()));
        try {
            mapper.insert(account);
        } catch (DuplicateKeyException error) {
            throw duplicateEmail();
        }
        return account;
    }

    private ApiException duplicateEmail() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
    }
}
