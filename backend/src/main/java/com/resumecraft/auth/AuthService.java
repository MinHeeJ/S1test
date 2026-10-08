package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionAuthentication;
import com.resumecraft.common.persistence.UserMapper;
import com.resumecraft.common.persistence.UserRow;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 계정 검증과 BCrypt 저장을 담당하며 세션 생성은 DB transaction 완료 후 controller에서 수행한다. */
@Service
public class AuthService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final UserMapper users;
    private final PasswordEncoder passwords;

    public AuthService(UserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    /** trim한 이메일의 unique 경합도 동일한 409로 변환하고 실패 시 세션을 만들지 않는다. */
    @Transactional
    public UserRow signup(SignupInput input) {
        String email = input.email() == null ? "" : input.email().trim();
        if (!EMAIL.matcher(email).matches()) {
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
        if (users.findByEmail(email) != null) {
            throw duplicate();
        }
        Instant now = Instant.now();
        var row = new UserRow(UUID.randomUUID(), email, input.nickname(),
                passwords.encode(input.password()), now, now);
        try {
            users.insert(row);
        } catch (DuplicateKeyException exception) {
            throw duplicate();
        }
        return row;
    }

    /** 로그인은 저장 row를 변경하지 않고 정확한 이메일과 BCrypt 자격증명만 비교한다. */
    @Transactional(readOnly = true)
    public UserRow login(LoginInput input) {
        if (input.email() == null) {
            throw invalid("email");
        }
        if (input.password() == null) {
            throw invalid("password");
        }
        UserRow row = users.findByEmail(input.email());
        if (row == null || !passwords.matches(input.password(), row.passwordHash())) {
            throw unauthorized();
        }
        return row;
    }

    /** principal UUID로 사용자 원천을 읽고 nickname만 공개한다. */
    @Transactional(readOnly = true)
    public CurrentUser getCurrentUser(Authentication authentication) {
        UserRow row = users.findById(SessionAuthentication.userId(authentication));
        if (row == null) {
            throw unauthorized();
        }
        return new CurrentUser(row.nickname());
    }

    private static ApiException invalid(String field) {
        return new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "입력값을 확인해주세요.", field);
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
    }

    private static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "이메일 또는 비밀번호를 확인해주세요.", null);
    }
}
