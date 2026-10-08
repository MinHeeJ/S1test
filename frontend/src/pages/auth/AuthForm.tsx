import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiRequestError } from "../../shared/http";
import { authApi } from "./authApi";
import "./auth.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Single-column public session forms; credentials are never put into browser storage. */
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    email: "",
    nickname: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState("");
  const submitting = useRef(false);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const invalid: Record<string, string> = {};
    if (signup) {
      if (!emailPattern.test(values.email.trim()))
        invalid.email = "이메일 형식을 확인해 주세요.";
      const length = [...values.nickname].length;
      if (length < 2 || length > 12)
        invalid.nickname = "닉네임은 2~12자여야 합니다.";
      if ([...values.password].length < 8)
        invalid.password = "비밀번호는 8자 이상이어야 합니다.";
      if (values.confirm !== values.password)
        invalid.confirm = "비밀번호가 일치하지 않습니다.";
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    submitting.current = true;
    setBusy(true);
    setToast("");
    try {
      const input = { email: values.email.trim(), password: values.password };
      if (signup) await authApi.signup({ ...input, nickname: values.nickname });
      else await authApi.login(input);
      await authApi.getCurrentUser();
      navigate("/resumes", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
      setToast(message);
      if (error instanceof ApiRequestError && error.body.field) {
        setErrors({ [error.body.field]: message });
      }
      if (signup && error instanceof ApiRequestError && error.status === 401) {
        navigate("/login", { replace: true });
      }
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  const fields: Array<{
    name: keyof typeof values;
    label: string;
    helper?: string;
  }> = signup
    ? [
        { name: "email", label: "이메일" },
        { name: "nickname", label: "닉네임", helper: "2~12자" },
        { name: "password", label: "비밀번호", helper: "8자 이상" },
        { name: "confirm", label: "비밀번호 확인" },
      ]
    : [
        { name: "email", label: "이메일" },
        { name: "password", label: "비밀번호" },
      ];
  return (
    <main className="auth-page">
      <section
        className="auth-column"
        aria-label={signup ? "회원가입" : "로그인"}
      >
        <Link
          className="auth-brand"
          to="/resumes"
          aria-label="ResumeCraft 이력서 목록"
        >
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <rect
              x="17"
              y="8"
              width="46"
              height="64"
              rx="8"
              fill="currentColor"
            />
            <path
              d="M29 28h22M29 40h22M29 52h14"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </Link>
        <header className="auth-heading">
          <h1>{signup ? "회원가입" : "로그인"}</h1>
          <p>
            {signup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}{" "}
            <Link to={signup ? "/login" : "/signup"}>
              {signup ? "로그인" : "회원가입"} →
            </Link>
          </p>
        </header>
        <form
          className="auth-form"
          onSubmit={submit}
          noValidate
          aria-busy={busy}
        >
          {fields.map(({ name, label, helper }) => {
            const password = name === "password" || name === "confirm";
            return (
              <div className="auth-field" key={name}>
                <label htmlFor={`auth-${name}`}>{label}</label>
                <div className={password ? "auth-password" : undefined}>
                  <input
                    id={`auth-${name}`}
                    name={name}
                    type={
                      password
                        ? visible
                          ? "text"
                          : "password"
                        : name === "email"
                          ? "email"
                          : "text"
                    }
                    inputMode={name === "email" ? "email" : undefined}
                    autoComplete={
                      password
                        ? signup
                          ? "new-password"
                          : "current-password"
                        : name === "email"
                          ? "email"
                          : "nickname"
                    }
                    value={values[name]}
                    disabled={busy}
                    aria-invalid={Boolean(errors[name])}
                    aria-describedby={
                      errors[name] || helper
                        ? `auth-${name}-message`
                        : undefined
                    }
                    onChange={(event) =>
                      setValues({ ...values, [name]: event.target.value })
                    }
                  />
                  {name === "password" && (
                    <button
                      className="auth-eye"
                      type="button"
                      aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
                          fill="none"
                          stroke="currentColor"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          fill="none"
                          stroke="currentColor"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {(errors[name] || helper) && (
                  <p
                    id={`auth-${name}-message`}
                    className={errors[name] ? "auth-error" : "auth-helper"}
                  >
                    {errors[name] ?? helper}
                  </p>
                )}
              </div>
            );
          })}
          <button
            className="auth-submit"
            type="submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy
              ? signup
                ? "가입 처리 중…"
                : "로그인 중…"
              : signup
                ? "회원가입"
                : "로그인"}
          </button>
        </form>
        {toast && (
          <div className="auth-toast" role="alert">
            {toast}
          </div>
        )}
      </section>
    </main>
  );
}
