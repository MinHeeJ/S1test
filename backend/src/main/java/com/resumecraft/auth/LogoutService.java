package com.resumecraft.auth;

import com.resumecraft.common.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Service;

/** Ends only the current session, never deleting business records. */
@Service
public class LogoutService {
    private final SessionContext sessions;

    public LogoutService(SessionContext sessions) {
        this.sessions = sessions;
    }

    public void logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.clear(request, response);
    }
}
