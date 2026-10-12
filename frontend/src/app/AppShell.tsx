import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Header, type HeaderProps } from "../shared/Header";

/** A single product navigation entry, not the reference site's unrelated applications/admin menu. */
export function AppShell({
  children,
  ...identity
}: HeaderProps & { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <aside className="sidebar">
        <span className="brand">ResumeCraft</span>
        <nav aria-label="이력서 탐색">
          <NavLink to="/resumes" aria-label="내 이력서">
            <span aria-hidden="true">▤</span>
            <span className="nav-label">내 이력서</span>
          </NavLink>
        </nav>
      </aside>
      <main id="main-content">
        <div className="page-wrapper">
          <Header {...identity} />
          {children}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="모바일 이력서 탐색">
        <NavLink to="/resumes">내 이력서</NavLink>
      </nav>
    </div>
  );
}
