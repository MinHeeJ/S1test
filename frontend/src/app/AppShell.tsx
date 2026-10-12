import type { ReactNode } from "react";
import "./app.css";

export interface AppShellProps {
  children: ReactNode;
  nickname?: string;
  logout?: ReactNode;
}

/** The feature assembly supplies the authenticated actor and page without a reverse import. */
export function AppShell({ children, nickname, logout }: AppShellProps) {
  return (
    <div className={nickname ? "app-shell authenticated" : "app-shell"}>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      {nickname && (
        <aside className="app-sidebar">
          <a className="brand" href="/resumes">
            ResumeCraft
          </a>
          <nav aria-label="주 메뉴">
            <a className="nav-link" href="/resumes" aria-label="내 이력서">
              <span aria-hidden="true">▤</span>
              <span className="nav-label">내 이력서</span>
            </a>
          </nav>
          <div className="sidebar-account">
            <span className="nickname">{nickname}</span>
            {logout}
          </div>
        </aside>
      )}
      <main id="main-content">
        <header className="app-header">
          <a className="brand" href="/resumes">
            ResumeCraft
          </a>
          {nickname && <span>{nickname}</span>}
          {logout}
        </header>
        {children}
      </main>
      {nickname && (
        <nav className="mobile-navigation" aria-label="모바일 메뉴">
          <a href="/resumes">내 이력서</a>
        </nav>
      )}
    </div>
  );
}
