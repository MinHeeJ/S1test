import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout, AuthApiError } from "./authApi";
import "./auth.css";

/** The shell can flush unsaved work before ending the session. */
export function LogoutButton({
  beforeLogout,
}: {
  beforeLogout?: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 3000);
    return () => window.clearTimeout(timer);
  }, [error]);
  async function exit() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await beforeLogout?.();
      await logout();
      navigate("/login", { replace: true });
    } catch (failure) {
      if (failure instanceof AuthApiError && failure.status === 401) {
        navigate("/login", { replace: true });
      } else setError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" disabled={busy} aria-busy={busy} onClick={exit}>
        {busy ? "로그아웃 중…" : "로그아웃"}
      </button>
      {error && (
        <div className="auth-toast" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
