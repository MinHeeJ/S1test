package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionUser;
import com.resumecraft.common.persistence.UserMapper;
import com.resumecraft.common.persistence.UserRow;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates a durable account; callers authenticate only after the transaction commits. */
@Service
public class SignupService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final UserMapper users;
    private final PasswordEncoder passwords;

    public SignupService(UserMapper users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    /** Validates Unicode lengths and preserves the exact email used by the unique constraint. */
    @Transactional
    public SessionUser signup(SignupInput input) {
        if (input.email() == null || !EMAIL.matcher(input.email()).matches()) {
            throw invalid("email");
        }
        if (input.nickname() == null || length(input.nickname()) < 2 || length(input.nickname()) > 12) {
            throw invalid("nickname");
        }
        if (input.password() == null || length(input.password()) < 8) {
            throw invalid("password");
        }
        if (users.findByEmail(input.email()) != null) {
            throw duplicate();
        }
        var now = OffsetDateTime.now();
        var row = new UserRow(UUID.randomUUID(), input.email(), input.nickname(),
            passwords.encode(input.password()), now, now);
        try {
            users.insert(row);
        } catch (DuplicateKeyException exception) {
            // The database unique constraint closes the concurrent signup race.
            throw duplicate();
        }
        return new SessionUser(row.id(), row.email(), row.nickname());
    }

    private static int length(String value) {
        return value.codePointCount(0, value.length());
    }

    private static ApiException invalid(String field) {
        return new ApiException(HttpStatus.BAD_REQUEST, "Bad Request", "Bad Request", field);
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
    }
}
