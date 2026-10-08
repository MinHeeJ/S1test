package com.resumecraft.auth;

import java.util.UUID;
import java.util.regex.Pattern;
import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionUser;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Validates signup and persists BCrypt credentials before automatic session establishment. */
@Service
public class SignupService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final AuthUserMapper users;
    private final PasswordEncoder passwords;

    public SignupService(AuthUserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    /** Invalid input and duplicate races leave the users table unchanged. */
    @Transactional
    public SessionUser signup(SignupInput input) {
        if (input.email() == null || !EMAIL.matcher(input.email().trim()).matches()) {
            throw invalid("email", "이메일 형식을 확인해 주세요.");
        }
        if (input.nickname() == null || points(input.nickname()) < 2 || points(input.nickname()) > 12) {
            throw invalid("nickname", "닉네임은 2~12자여야 합니다.");
        }
        if (input.password() == null || points(input.password()) < 8) {
            throw invalid("password", "비밀번호는 8자 이상이어야 합니다.");
        }
        var account = new AuthAccount(UUID.randomUUID(), input.email().trim(), input.nickname(),
                passwords.encode(input.password()));
        try {
            users.insert(account);
        } catch (DuplicateKeyException error) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", null);
        }
        return account.sessionUser();
    }

    private static int points(String value) {
        return value.codePointCount(0, value.length());
    }

    private static ApiException invalid(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", message, field);
    }
}
