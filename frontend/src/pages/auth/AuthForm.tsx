import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiRequestError } from "../../shared/apiClient";
import { getCurrentUser, login, signup } from "./authApi";
import "./auth.css";

/** Shared vertical form keeps credentials only in component memory. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const joining = mode === "signup";
  const [values, setValues] = useState({
    email: "",
    nickname: "",
    password: "",
    confirmation: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const checkSession = () => {
    setChecking(true);
    setCheckError(false);
    void getCurrentUser()
      .then(
        () => navigate("/resumes", { replace: true }),
        (error) => {
          if (!(error instanceof ApiRequestError && error.status === 401))
            setCheckError(true);
        },
      )
      .finally(() => setChecking(false));
  };
  useEffect(checkSession, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const invalid: Record<string, string> = {};
    if (joining) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        invalid.email = "이메일 형식을 확인해 주세요.";
      }
      if (
        Array.from(values.nickname).length < 2 ||
        Array.from(values.nickname).length > 12
      ) {
        invalid.nickname = "닉네임은 2~12자여야 합니다.";
      }
      if (Array.from(values.password).length < 8)
        invalid.password = "비밀번호는 8자 이상이어야 합니다.";
      if (values.password !== values.confirmation)
        invalid.confirmation = "비밀번호가 일치하지 않습니다.";
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    busy.current = true;
    setPending(true);
    try {
      const credentials = {
        email: values.email.trim(),
        password: values.password,
      };
      if (joining) await signup({ ...credentials, nickname: values.nickname });
      else await login(credentials);
      await getCurrentUser();
      navigate("/resumes", { replace: true });
    } catch (error) {
      const text =
        error instanceof ApiRequestError
          ? error.error.message
          : "서비스 연결에 실패했습니다. 다시 시도해 주세요.";
      setMessage(text);
      if (error instanceof ApiRequestError && error.error.field) {
        setErrors({ [error.error.field]: text });
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (checking)
    return (
      <p className="auth-loading" role="status">
        세션 확인 중…
      </p>
    );
  if (checkError)
    return (
      <section className="auth-form">
        <p role="alert">세션을 확인하지 못했습니다.</p>
        <button onClick={checkSession}>다시 시도</button>
      </section>
    );
  const fields = joining
    ? ["email", "nickname", "password", "confirmation"]
    : ["email", "password"];
  const labels: Record<string, string> = {
    email: "이메일",
    nickname: "닉네임",
    password: "비밀번호",
    confirmation: "비밀번호 확인",
  };
  return (
    <section className="auth-form" aria-labelledby="auth-title">
      <header className="auth-intro">
        <h1 id="auth-title">{joining ? "회원가입" : "로그인"}</h1>
        <p>
          {joining
            ? "나의 다음 기회를 준비해 보세요."
            : "이어서 나의 이야기를 작성하세요."}
        </p>
      </header>
      <form onSubmit={submit} noValidate aria-busy={pending}>
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
              autoComplete={
                field === "email"
                  ? "username"
                  : field === "nickname"
                    ? "nickname"
                    : joining
                      ? "new-password"
                      : "current-password"
              }
              value={values[field as keyof typeof values]}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  [field]: event.target.value,
                }))
              }
              disabled={pending}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `error-${field}` : undefined}
            />
            {errors[field] && (
              <p className="auth-error" id={`error-${field}`}>
                {errors[field]}
              </p>
            )}
          </div>
        ))}
        <button className="primary" type="submit" disabled={pending}>
          {pending
            ? joining
              ? "가입 처리 중…"
              : "로그인 중…"
            : joining
              ? "회원가입"
              : "로그인"}
        </button>
      </form>
      {message && (
        <div className="auth-toast" role="alert">
          {message}
        </div>
      )}
    </section>
  );
}
