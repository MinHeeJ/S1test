import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthApiError, login, signup } from "./authApi";
import "./auth.css";

/** A single-column credentials form with local confirmation and server field errors. */
export function AuthForm({ registration }: { registration: boolean }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    email: "",
    nickname: "",
    password: "",
    confirmation: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const invalid: Record<string, string> = {};
    if (registration) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
        invalid.email = "이메일 형식을 확인해 주세요.";
      const count = Array.from(values.nickname).length;
      if (count < 2 || count > 12)
        invalid.nickname = "닉네임은 2~12자여야 합니다.";
      if (Array.from(values.password).length < 8)
        invalid.password = "비밀번호는 8자 이상이어야 합니다.";
      if (values.password !== values.confirmation)
        invalid.confirmation = "비밀번호가 일치하지 않습니다.";
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    pending.current = true;
    setBusy(true);
    setToast("");
    try {
      const input = { email: values.email, password: values.password };
      if (registration) await signup({ ...input, nickname: values.nickname });
      else await login(input);
      navigate("/resumes", { replace: true });
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.status === 401
            ? "이메일 또는 비밀번호를 확인해 주세요."
            : error.message
          : "요청에 실패했습니다. 다시 시도해 주세요.";
      if (error instanceof AuthApiError && error.field)
        setErrors({ [error.field]: message });
      setToast(message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const fields = registration
    ? (["email", "nickname", "password", "confirmation"] as const)
    : (["email", "password"] as const);
  const labels = {
    email: "이메일",
    nickname: "닉네임",
    password: "비밀번호",
    confirmation: "비밀번호 확인",
  };
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="auth-brand">ResumeCraft</p>
        <h1 id="auth-title">{registration ? "회원가입" : "로그인"}</h1>
        <p className="auth-intro">
          {registration ? "이미 계정이 있으신가요?" : "아직 계정이 없으신가요?"}{" "}
          <Link to={registration ? "/login" : "/signup"}>
            {registration ? "로그인" : "회원가입"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </p>
        <form onSubmit={submit} noValidate>
          {fields.map((field) => (
            <div className="auth-field" key={field}>
              <label htmlFor={`auth-${field}`}>{labels[field]}</label>
              <input
                id={`auth-${field}`}
                name={field}
                type={
                  field === "password" || field === "confirmation"
                    ? "password"
                    : "text"
                }
                inputMode={field === "email" ? "email" : undefined}
                autoComplete={
                  field === "email"
                    ? "username"
                    : field === "nickname"
                      ? "nickname"
                      : registration
                        ? "new-password"
                        : "current-password"
                }
                value={values[field]}
                disabled={busy}
                aria-invalid={Boolean(errors[field])}
                aria-describedby={
                  errors[field] ? `auth-${field}-error` : undefined
                }
                onChange={(event) =>
                  setValues({ ...values, [field]: event.target.value })
                }
              />
              {errors[field] && (
                <p id={`auth-${field}-error`} className="auth-error">
                  {errors[field]}
                </p>
              )}
              {registration && field === "nickname" && <small>2~12자</small>}
              {registration && field === "password" && <small>8자 이상</small>}
            </div>
          ))}
          <button type="submit" disabled={busy} aria-busy={busy}>
            {busy && <span className="auth-spinner" aria-hidden="true" />}
            {busy
              ? registration
                ? "가입 처리 중…"
                : "로그인 중…"
              : registration
                ? "회원가입"
                : "로그인"}
          </button>
        </form>
      </section>
      {toast && (
        <div className="auth-toast" role="alert">
          {toast}
        </div>
      )}
    </main>
  );
}
