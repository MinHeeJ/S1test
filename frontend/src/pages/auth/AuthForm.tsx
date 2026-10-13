import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiRequestError, bootstrapCsrf } from "../../shared/apiClient";
import { useToastStore } from "../../shared/Toast";
import { confirmSession, login, signup } from "./authApi";
import "./auth.css";

type Field = "email" | "nickname" | "password" | "confirmation";
const labels: Record<Field, string> = {
  email: "이메일",
  nickname: "닉네임",
  password: "비밀번호",
  confirmation: "비밀번호 확인",
};

/** Public account form: never retries a mutation after an uncertain or committed result. */
export function AuthForm({ registration }: { registration: boolean }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    email: "",
    nickname: "",
    password: "",
    confirmation: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const pending = useRef(false);
  const label = registration ? "회원가입" : "로그인";
  const fields: Field[] = registration
    ? ["email", "nickname", "password", "confirmation"]
    : ["email", "password"];

  useEffect(() => {
    let active = true;
    void bootstrapCsrf().catch((error: unknown) => {
      if (active)
        setMessage(error instanceof Error ? error.message : "서비스 연결 실패");
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || committed) return;
    const validation: Partial<Record<Field, string>> = {};
    if (registration) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(values.email))
        validation.email = "이메일 형식을 확인하세요";
      const length = [...values.nickname].length;
      if (length < 2 || length > 12)
        validation.nickname = "닉네임은 2~12자입니다";
      if ([...values.password].length < 8)
        validation.password = "비밀번호는 8자 이상입니다";
      if (values.password !== values.confirmation)
        validation.confirmation = "비밀번호와 일치해야 합니다";
    }
    setErrors(validation);
    setMessage("");
    if (Object.keys(validation).length) return;
    pending.current = true;
    setBusy(true);
    let completed = false;
    try {
      if (registration) {
        await signup({
          email: values.email,
          nickname: values.nickname,
          password: values.password,
        });
      } else {
        await login({ email: values.email, password: values.password });
      }
      completed = true;
      setCommitted(true);
      await confirmSession();
      navigate("/resumes", { replace: true });
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
      const text = completed
        ? `${label}은 완료되었으나 사용자 확인에 실패했습니다. ${detail}`
        : detail;
      setMessage(text);
      if (
        error instanceof ApiRequestError &&
        error.error.field &&
        fields.includes(error.error.field as Field)
      ) {
        setErrors({ [error.error.field]: error.message });
      }
      useToastStore.getState().show(text);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
      <div className="auth-heading">
        <span className="auth-emblem" aria-hidden="true">
          RC<span>▰ ▰ ▰</span>
        </span>
        <h1>{label}</h1>
        <p>
          {registration
            ? "나만의 경험을 담을 공간을 만드세요."
            : "다음 기회를 위한 이력서, 이어서 완성하세요."}
        </p>
      </div>
      <fieldset disabled={busy || committed}>
        {fields.map((field) => (
          <div className="auth-field" key={field}>
            <label htmlFor={`auth-${field}`}>{labels[field]}</label>
            <input
              id={`auth-${field}`}
              name={field}
              type={
                field === "password" || field === "confirmation"
                  ? "password"
                  : field === "email"
                    ? "email"
                    : "text"
              }
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
              aria-invalid={Boolean(errors[field])}
              aria-describedby={
                errors[field] ? `auth-${field}-error` : undefined
              }
              onChange={(event) =>
                setValues({ ...values, [field]: event.target.value })
              }
            />
            {errors[field] && (
              <p id={`auth-${field}-error`} role="alert">
                {errors[field]}
              </p>
            )}
            {registration && field === "nickname" && !errors[field] && (
              <small>2~12자</small>
            )}
            {registration && field === "password" && !errors[field] && (
              <small>8자 이상</small>
            )}
          </div>
        ))}
        <button
          className="primary"
          type="submit"
          aria-busy={busy}
          disabled={busy || committed}
        >
          {busy ? `${label} 처리 중…` : label}
        </button>
      </fieldset>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
