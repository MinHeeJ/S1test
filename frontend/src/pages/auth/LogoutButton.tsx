import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "./authApi";
import "./auth.css";

/** Editor shells can supply their save/navigation guard before ending the session. */
export function LogoutButton({
  beforeLogout,
}: {
  beforeLogout?: () => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 3000);
    return () => clearTimeout(timer);
  }, [error]);
  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (beforeLogout && !(await beforeLogout())) return;
      await authApi.logout();
      navigate("/login", { replace: true });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "로그아웃하지 못했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <span>
      <button type="button" disabled={busy} onClick={logout}>
        {busy ? "로그아웃 중…" : "로그아웃"}
      </button>
      {error && (
        <span className="auth-toast" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
