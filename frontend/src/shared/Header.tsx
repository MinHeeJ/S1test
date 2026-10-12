import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "./Toast";

export interface HeaderProps {
  nickname?: string;
  onLogout?: () => Promise<void>;
  beforeNavigate?: () => Promise<void>;
}

/** Protected screens supply a logout command which includes their own latest-draft flush. */
export function Header({ nickname, onLogout, beforeNavigate }: HeaderProps) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const show = useToast((state) => state.show);
  async function logout() {
    if (!onLogout || busy) return;
    setBusy(true);
    try {
      await onLogout();
      navigate("/login");
    } catch {
      show("로그아웃하지 못했습니다. 변경 사항을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <header className="product-header">
      {nickname ? (
        <Link
          to="/resumes"
          onClick={(event) => {
            if (!beforeNavigate) return;
            event.preventDefault();
            void beforeNavigate()
              .then(() => navigate("/resumes"))
              .catch(() => show("저장하지 못했습니다."));
          }}
        >
          ResumeCraft
        </Link>
      ) : (
        <span className="brand">ResumeCraft</span>
      )}
      {nickname && (
        <div className="identity">
          <span>{nickname}</span>
          <button
            type="button"
            disabled={busy || !onLogout}
            aria-busy={busy}
            onClick={() => void logout()}
          >
            로그아웃
          </button>
        </div>
      )}
    </header>
  );
}
