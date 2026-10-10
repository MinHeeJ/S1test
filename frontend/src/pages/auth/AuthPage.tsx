import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../shared/apiClient";
import { getCurrentUser, login, signup } from "./authApi";
import "./auth.css";
import { ScreenState } from "../../shared/ScreenState";

/** Shared account form: confirmation stays local and a successful server response precedes navigation. */
export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const registering = mode === "signup";
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setChecking(true);
    setConnectionError("");
    getCurrentUser()
      .then(() => {
        if (active) navigate("/resumes", { replace: true });
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof ApiError && error.status === 401)) {
          setConnectionError(
            "로그인 상태를 확인할 수 없습니다. 다시 시도해 주세요.",
          );
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [navigate, attempt]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "이메일을 입력해 주세요.";
    if (!password) next.password = "비밀번호를 입력해 주세요.";
    if (registering) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        next.email = "이메일 형식을 확인해 주세요.";
      if (Array.from(nickname).length < 2 || Array.from(nickname).length > 12) {
        next.nickname = "닉네임은 2~12자로 입력해 주세요.";
      }
      if (Array.from(password).length < 8)
        next.password = "비밀번호는 8자 이상으로 입력해 주세요.";
      if (password !== confirmation)
        next.confirmation = "비밀번호가 일치하지 않습니다.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    pending.current = true;
    setBusy(true);
    try {
      if (registering)
        await signup({ email: email.trim(), nickname, password });
      else await login({ email: email.trim(), password });
      // The parent session owner may refresh its identity/draft policy after this event.
      window.dispatchEvent(new Event("session-authenticated"));
      navigate("/resumes", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청을 처리할 수 없습니다.";
      if (error instanceof ApiError && error.body.field)
        setErrors({ [error.body.field]: message });
      setToast(message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (checking)
    return (
      <section className="auth-layout">
        <ScreenState message="로그인 상태 확인 중…" />
      </section>
    );
  if (connectionError)
    return (
      <section className="auth-layout">
        <p role="alert">{connectionError}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          다시 시도
        </button>
      </section>
    );
  return (
    <section className="auth-layout">
      <div className="auth-card">
        <span className="auth-brand">ResumeCraft</span>
        <h1>{registering ? "회원가입" : "로그인"}</h1>
        <p className="auth-description">
          {registering
            ? "나만의 이력서를 만들어 보세요."
            : "이력서 작성을 이어가세요."}
        </p>
        <form onSubmit={submit} noValidate>
          <fieldset disabled={busy}>
            <label htmlFor="auth-email">이메일</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "auth-email-error" : undefined}
            />
            {errors.email && (
              <p id="auth-email-error" className="auth-error">
                {errors.email}
              </p>
            )}
            {registering && (
              <>
                <label htmlFor="auth-nickname">닉네임</label>
                <input
                  id="auth-nickname"
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  aria-invalid={Boolean(errors.nickname)}
                  aria-describedby={
                    errors.nickname ? "auth-nickname-error" : undefined
                  }
                />
                {errors.nickname && (
                  <p id="auth-nickname-error" className="auth-error">
                    {errors.nickname}
                  </p>
                )}
              </>
            )}
            <label htmlFor="auth-password">비밀번호</label>
            <div className="auth-password-control">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={registering ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "auth-password-error" : undefined
                }
              />
              <button
                type="button"
                className="auth-reveal"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"
                    stroke="currentColor"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" />
                  {showPassword && (
                    <path d="m3 3 18 18" stroke="currentColor" />
                  )}
                </svg>
              </button>
            </div>
            {errors.password && (
              <p id="auth-password-error" className="auth-error">
                {errors.password}
              </p>
            )}
            {registering && (
              <>
                <label htmlFor="auth-confirmation">비밀번호 확인</label>
                <input
                  id="auth-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  aria-invalid={Boolean(errors.confirmation)}
                  aria-describedby={
                    errors.confirmation ? "auth-confirmation-error" : undefined
                  }
                />
                {errors.confirmation && (
                  <p id="auth-confirmation-error" className="auth-error">
                    {errors.confirmation}
                  </p>
                )}
              </>
            )}
            <button type="submit" aria-busy={busy} disabled={busy}>
              {busy ? "처리 중…" : registering ? "회원가입" : "로그인"}
            </button>
          </fieldset>
        </form>
        {!busy && (
          <Link to={registering ? "/login" : "/signup"}>
            {registering
              ? "이미 계정이 있나요? 로그인"
              : "계정이 없나요? 회원가입"}
          </Link>
        )}
      </div>
      {toast && (
        <p className="auth-toast" role="alert">
          {toast}
        </p>
      )}
    </section>
  );
}
