package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionAuthentication;
import com.resumecraft.common.persistence.UserRow;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 인증 HTTP 경계. 서비스 transaction 성공 후 세션을 회전하고 명시 저장한다. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final SessionAuthentication sessions;

    public AuthController(AuthService auth, SessionAuthentication sessions) {
        this.auth = auth;
        this.sessions = sessions;
    }

    /** 계정 생성 후 자동 로그인한다. 성공 명령에 미승인 data를 추가하지 않는다. */
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> signup(
            @RequestBody SignupInput input, HttpServletRequest request, HttpServletResponse response) {
        establish(auth.signup(input), request, response);
        return ApiResponse.ok();
    }

    /** BCrypt 검증이 성공한 사용자만 동일 세션 보호 API에 접근하도록 인증한다. */
    @PostMapping("/login")
    public ApiResponse<Void> login(
            @RequestBody LoginInput input, HttpServletRequest request, HttpServletResponse response) {
        establish(auth.login(input), request, response);
        return ApiResponse.ok();
    }

    /** 현재 세션과 cookie만 종료한다. 업무 데이터는 변경하지 않는다. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        SessionAuthentication.userId(authentication);
        sessions.logout(request, response, authentication);
        return ApiResponse.ok();
    }

    /** 서버 사용자 원천의 nickname만 반환한다. CSRF bootstrap은 공통 filter가 담당한다. */
    @GetMapping("/me")
    public ApiResponse<CurrentUser> getCurrentUser(Authentication authentication) {
        return ApiResponse.ok(auth.getCurrentUser(authentication));
    }

    private void establish(UserRow row, HttpServletRequest request, HttpServletResponse response) {
        var authentication = new UsernamePasswordAuthenticationToken(row.id().toString(), null, List.of());
        sessions.establish(authentication, request, response);
    }
}
