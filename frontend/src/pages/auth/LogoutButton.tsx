import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "./authApi";

/** The editor supplies its save queue flush; failure must keep the session and edits. */
export function LogoutButton({
  beforeLogout,
  onLoggedOut,
}: {
  beforeLogout?: () => Promise<void>;
  onLoggedOut?: () => void;
}) {
  const navigate = useNavigate();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function leave() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await beforeLogout?.();
      await logout();
      onLoggedOut?.();
      navigate("/login", { replace: true });
    } catch {
      setError("저장 또는 로그아웃에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <button onClick={() => void leave()} disabled={pending}>
        {pending ? "로그아웃 중…" : "로그아웃"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
