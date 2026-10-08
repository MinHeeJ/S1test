import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/apiClient";
import { AppShell } from "../../app/AppShell";
import { Toast } from "../../shared/Toast";
import { authApi } from "./authApi";
import { PublicAuthGuard } from "./PublicAuthGuard";
import "./auth.css";

export function LoginPage() {
  return (
    <PublicAuthGuard>
      <AppShell>
        <LoginForm />
      </AppShell>
    </PublicAuthGuard>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{
    message: string;
    field: string | null;
  }>();
  const [toast, setToast] = useState<string>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      await authApi.login({ email, password });
      await authApi.me();
      navigate("/resumes", { replace: true });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "로그인에 실패했습니다.";
      setError({
        message,
        field: cause instanceof ApiError ? cause.field : null,
      });
      setToast(message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <header className="auth-heading">
        <span className="auth-eyebrow">내 이력서 시작하기</span>
        <h1 id="login-title">로그인</h1>
        <p className="auth-intro">
          계정에 로그인하고 이력서 작성을 이어가세요.
        </p>
      </header>
      <form
        onSubmit={submit}
        noValidate
        aria-busy={pending}
        aria-labelledby="login-title"
      >
        <div className="auth-field">
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            type="text"
            inputMode="email"
            autoComplete="username"
            aria-required="true"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error?.field === "email"}
            aria-describedby={
              error?.field === "email" ? "login-error" : undefined
            }
          />
        </div>
        <div className="auth-field">
          <label htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-required="true"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error?.field === "password"}
            aria-describedby={
              error?.field === "password" ? "login-error" : undefined
            }
          />
        </div>
        {error && (
          <p id="login-error" className="field-warning">
            {error.message}
          </p>
        )}
        <button
          aria-busy={pending}
          className="primary"
          disabled={pending}
          type="submit"
        >
          {pending ? "로그인 중…" : "로그인"}
        </button>
      </form>
      <p className="auth-switch">
        아직 계정이 없으신가요? <Link to="/signup">회원가입</Link>
      </p>
      {toast && (
        <Toast
          message={toast}
          tone="error"
          onClose={() => setToast(undefined)}
        />
      )}
    </section>
  );
}
