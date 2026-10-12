import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../../shared/api";
import { Header } from "../../shared/Header";
import { useToast } from "../../shared/Toast";
import { useSessionStore } from "../../app/session";
import { getCurrentUser, login, signup } from "./authApi";
import "./auth.css";

type Field = "email" | "nickname" | "password" | "confirmation";

/** Public credential form: no browser persistence, invented user, or automatic command retries. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const registering = mode === "signup";
  const navigate = useNavigate();
  const status = useSessionStore((state) => state.status);
  const [values, setValues] = useState<Record<Field, string>>({
    email: "",
    nickname: "",
    password: "",
    confirmation: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [created, setCreated] = useState(false);
  if (status === "authenticated") return <Navigate to="/resumes" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || created) return;
    const invalid: Partial<Record<Field, string>> = {};
    if (registering) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
        invalid.email = "이메일 형식을 확인하세요.";
      if (values.nickname.length < 2 || values.nickname.length > 12)
        invalid.nickname = "닉네임은 2~12자입니다.";
      if (values.password.length < 8)
        invalid.password = "비밀번호는 8자 이상입니다.";
      if (values.password !== values.confirmation)
        invalid.confirmation = "비밀번호가 일치하지 않습니다.";
    }
    setErrors(invalid);
    setMessage(null);
    if (Object.keys(invalid).length) return;
    inFlight.current = true;
    setBusy(true);
    let committed = false;
    try {
      if (registering) {
        await signup({
          email: values.email,
          nickname: values.nickname,
          password: values.password,
        });
        committed = true;
        setCreated(true);
      } else {
        await login({ email: values.email, password: values.password });
      }
      const user = await getCurrentUser();
      useSessionStore.setState({ status: "authenticated", user, error: null });
      navigate("/resumes", { replace: true });
    } catch (error) {
      const text = committed
        ? "가입은 완료되었으나 사용자 정보를 확인하지 못했습니다. 페이지를 새로고침해 주세요."
        : error instanceof ApiError
          ? error.body.message
          : "인증 정보를 확인하지 못했습니다.";
      setMessage(text);
      useToast.getState().show(text);
      if (
        error instanceof ApiError &&
        error.body.field &&
        error.body.field in values
      ) {
        setErrors({ [error.body.field]: text });
      }
      if (
        registering &&
        committed &&
        error instanceof ApiError &&
        error.status === 401
      ) {
        useSessionStore.getState().clear();
        navigate("/login", { replace: true });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const fields: Field[] = registering
    ? ["email", "nickname", "password", "confirmation"]
    : ["email", "password"];
  const labels: Record<Field, string> = {
    email: "이메일",
    nickname: "닉네임",
    password: "비밀번호",
    confirmation: "비밀번호 확인",
  };
  return (
    <main className="auth-page">
      <div className="auth-content">
        <Header />
        <section aria-labelledby="auth-heading" className="auth-panel">
          <div className="auth-heading">
            <h1 id="auth-heading">{registering ? "회원가입" : "로그인"}</h1>
            <p className="auth-description">
              {registering
                ? "나의 경험을 담을 공간을 만들어 보세요."
                : "다시 만나 반가워요. 나만의 이력서를 이어서 작성하세요."}
            </p>
          </div>
          <form noValidate onSubmit={submit}>
            {fields.map((field) => (
              <div key={field} className="auth-field">
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
                        : registering
                          ? "new-password"
                          : "current-password"
                  }
                  inputMode={field === "email" ? "email" : undefined}
                  value={values[field]}
                  disabled={busy || created}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field] ? `${field}-error` : undefined
                  }
                  onChange={(event) =>
                    setValues({ ...values, [field]: event.target.value })
                  }
                />
                {errors[field] && (
                  <span id={`${field}-error`} className="field-error">
                    {errors[field]}
                  </span>
                )}
              </div>
            ))}
            {message && <p role="alert">{message}</p>}
            {busy && (
              <p role="status">
                {registering ? "가입 처리 중…" : "로그인 처리 중…"}
              </p>
            )}
            <button
              type="submit"
              className="primary"
              disabled={busy || created}
              aria-busy={busy}
            >
              {registering ? "회원가입" : "로그인"}
            </button>
            {busy ? (
              <span>{registering ? "로그인" : "회원가입"}</span>
            ) : (
              <Link to={registering ? "/login" : "/signup"}>
                {registering ? "로그인" : "회원가입"}
              </Link>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
