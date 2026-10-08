import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/apiClient";
import { AppShell } from "../../app/AppShell";
import { Toast } from "../../shared/Toast";
import { authApi } from "./authApi";
import { PublicAuthGuard } from "./PublicAuthGuard";
import "./auth.css";

type Field = "email" | "nickname" | "password" | "confirmation";

export function SignupPage() {
  return (
    <PublicAuthGuard>
      <AppShell>
        <SignupForm />
      </AppShell>
    </PublicAuthGuard>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<Field, string>>({
    email: "",
    nickname: "",
    password: "",
    confirmation: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const issues: Partial<Record<Field, string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      issues.email = "이메일 형식을 확인해주세요.";
    const length = [...values.nickname].length;
    if (length < 2 || length > 12)
      issues.nickname = "닉네임은 2~12자로 입력해주세요.";
    if ([...values.password].length < 8)
      issues.password = "비밀번호는 8자 이상 입력해주세요.";
    if (values.password !== values.confirmation)
      issues.confirmation = "비밀번호가 일치하지 않습니다.";
    setErrors(issues);
    if (Object.keys(issues).length) return;
    setPending(true);
    try {
      await authApi.signup({
        email: values.email.trim(),
        nickname: values.nickname,
        password: values.password,
      });
      await authApi.me();
      navigate("/resumes", { replace: true });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "가입에 실패했습니다.";
      if (cause instanceof ApiError && cause.field && cause.field in values) {
        setErrors({ [cause.field]: message });
      }
      setToast(message);
    } finally {
      setPending(false);
    }
  }
  const fields: {
    key: Field;
    label: string;
    hint?: string;
    autocomplete: string;
  }[] = [
    { key: "email", label: "이메일", autocomplete: "email" },
    {
      key: "nickname",
      label: "닉네임",
      hint: "2~12자",
      autocomplete: "nickname",
    },
    {
      key: "password",
      label: "비밀번호",
      hint: "8자 이상",
      autocomplete: "new-password",
    },
    {
      key: "confirmation",
      label: "비밀번호 확인",
      autocomplete: "new-password",
    },
  ];
  return (
    <section className="auth-panel" aria-labelledby="signup-title">
      <header className="auth-heading">
        <span className="auth-eyebrow">나만의 이력서 시작하기</span>
        <h1 id="signup-title">회원가입</h1>
        <p className="auth-intro">계정을 만들고 첫 이력서를 작성해보세요.</p>
      </header>
      <form
        onSubmit={submit}
        noValidate
        aria-busy={pending}
        aria-labelledby="signup-title"
      >
        {fields.map(({ key, label, hint, autocomplete }) => (
          <div className="auth-field" key={key}>
            <label htmlFor={`signup-${key}`}>{label}</label>
            <input
              id={`signup-${key}`}
              type={
                key === "password" || key === "confirmation"
                  ? "password"
                  : key === "email"
                    ? "email"
                    : "text"
              }
              autoComplete={autocomplete}
              aria-required="true"
              value={values[key]}
              onChange={(event) =>
                setValues({ ...values, [key]: event.target.value })
              }
              aria-invalid={Boolean(errors[key])}
              aria-describedby={
                errors[key] || hint ? `signup-${key}-help` : undefined
              }
            />
            <div
              className="auth-feedback"
              aria-live={toast ? "off" : "polite"}
              aria-atomic="true"
            >
              {(errors[key] || hint) && (
                <p
                  id={`signup-${key}-help`}
                  className={errors[key] ? "field-warning" : "auth-hint"}
                >
                  {errors[key] ?? hint}
                </p>
              )}
            </div>
          </div>
        ))}
        <button
          aria-busy={pending}
          className="primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "가입 처리 중…" : "회원가입"}
        </button>
      </form>
      <p className="auth-switch">
        이미 계정이 있으신가요? <Link to="/login">로그인</Link>
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
