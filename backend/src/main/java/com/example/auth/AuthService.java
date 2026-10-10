package com.example.auth;

import com.example.common.ApiException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Validates registration and compares BCrypt credentials against the persisted users source. */
@Service
public class AuthService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final AuthMapper mapper;
    private final PasswordEncoder encoder;
    private final String absentUserHash;

    public AuthService(AuthMapper mapper, PasswordEncoder encoder) {
        this.mapper = mapper;
        this.encoder = encoder;
        this.absentUserHash = encoder.encode(UUID.randomUUID().toString());
    }

    /** The users INSERT commits before the controller establishes a session; uniqueness is enforced by DB. */
    @Transactional
    public AuthUser signup(SignupInput input) {
        if (input.getEmail() == null || !EMAIL.matcher(input.getEmail().trim()).matches()) {
            throw invalid("email");
        }
        String nickname = input.getNickname();
        int length = nickname == null ? 0 : nickname.codePointCount(0, nickname.length());
        if (length < 2 || length > 12) {
            throw invalid("nickname");
        }
        if (input.getPassword() == null
            || input.getPassword().codePointCount(0, input.getPassword().length()) < 8) {
            throw invalid("password");
        }
        var user = new AuthUser();
        user.setId(UUID.randomUUID());
        user.setEmail(input.getEmail().trim());
        user.setNickname(nickname);
        user.setPasswordHash(encoder.encode(input.getPassword()));
        try {
            mapper.insert(user);
        } catch (DuplicateKeyException exception) {
            throw new ApiException(409, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
        }
        return user;
    }

    /** Unknown email and wrong password have identical errors and both perform a BCrypt comparison. */
    @Transactional(readOnly = true)
    public AuthUser login(LoginInput input) {
        if (input.getEmail() == null) {
            throw invalid("email");
        }
        if (input.getPassword() == null) {
            throw invalid("password");
        }
        var user = mapper.findByEmail(input.getEmail().trim());
        boolean matches = encoder.matches(input.getPassword(), user == null ? absentUserHash : user.getPasswordHash());
        if (user == null || !matches) {
            throw unauthenticated();
        }
        return user;
    }

    /** Reloads the nickname rather than treating session display data as a durable account source. */
    @Transactional(readOnly = true)
    public CurrentUser getCurrentUser(UUID id) {
        var user = mapper.findById(id);
        if (user == null) {
            throw unauthenticated();
        }
        return new CurrentUser(user.getNickname());
    }

    private static ApiException invalid(String field) {
        return new ApiException(400, "400", "입력값을 확인해 주세요.", field);
    }

    private static ApiException unauthenticated() {
        return new ApiException(401, "401", "이메일 또는 비밀번호를 확인해 주세요.", null);
    }
}
