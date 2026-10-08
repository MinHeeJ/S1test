package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionUser;
import com.resumecraft.common.persistence.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads the current account from persistence without exposing credentials or trusting stale session fields. */
@Service
public class CurrentUserService {
    private final UserMapper users;

    public CurrentUserService(UserMapper users) {
        this.users = users;
    }

    /** The session supplies identity only; a missing account cannot produce a current-user response. */
    @Transactional(readOnly = true)
    public CurrentUserController.CurrentUser getCurrentUser(SessionUser user) {
        if (user == null) {
            throw unauthorized();
        }
        var row = users.findById(user.id());
        if (row == null) {
            throw unauthorized();
        }
        return new CurrentUserController.CurrentUser(row.nickname());
    }

    private ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Unauthorized", null);
    }
}
