import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type AppShellProps = {
  children: ReactNode;
  nickname?: string;
  onLogout?: () => void;
};
/** 제품의 공개/인증 header를 분리하며 실제 session에서 받은 nickname만 표시한다. */
export function AppShell({ children, nickname, onLogout }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <header className="app-header">
        <Link className="brand" to="/resumes">
          ResumeCraft
        </Link>
        {nickname !== undefined && (
          <div className="account-controls">
            <span>{nickname}</span>
            {onLogout && <button onClick={onLogout}>로그아웃</button>}
          </div>
        )}
      </header>
      <main id="main-content" className="page-content">
        {children}
      </main>
    </div>
  );
}
