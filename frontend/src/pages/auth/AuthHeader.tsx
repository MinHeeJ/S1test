import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "./authApi";
import "./auth.css";

/** Parent supplies editor flush and draft disposal; logout must never precede a successful flush. */
export function AuthHeader({
  beforeLogout,
  onLoggedOut,
}: {
  beforeLogout?: () => Promise<void>;
  onLoggedOut?: () => void;
}) {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((response) => {
        if (active) setNickname(response.data.nickname);
      })
      .catch((failure: unknown) => {
        if (active)
          setError(failure instanceof Error ? failure.message : "조회 실패");
      });
    return () => {
      active = false;
    };
  }, []);
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
      onLoggedOut?.();
      window.dispatchEvent(new Event("session-logged-out"));
      navigate("/login", { replace: true });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "로그아웃에 실패했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <header className="auth-header">
      <span className="auth-brand">ResumeCraft</span>
      {nickname !== null && <span>{nickname}</span>}
      <button
        onClick={exit}
        disabled={busy || nickname === null}
        aria-busy={busy}
      >
        로그아웃
      </button>
      {error && (
        <p role="alert" className="auth-toast">
          {error}
        </p>
      )}
    </header>
  );
}
