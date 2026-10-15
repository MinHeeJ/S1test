import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { apiRequest } from "../shared/apiClient";
import { Toast, useToastStore } from "../shared/Toast";
import { flushBeforeNavigation } from "./navigationGuard";
import { useSessionStore } from "./sessionStore";

export function AppShell() {
  const user = useSessionStore((state) => state.user);
  const clear = useSessionStore((state) => state.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const editor = location.pathname.endsWith("/edit");
  const auth = ["/login", "/signup"].includes(location.pathname);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await flushBeforeNavigation();
      await apiRequest("/api/auth/logout", { method: "POST" });
      clear();
      navigate("/login");
    } catch (error) {
      useToastStore
        .getState()
        .show(error instanceof Error ? error.message : "로그아웃 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={
        editor ? "editor-shell" : auth ? "app-shell auth-shell" : "app-shell"
      }
    >
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <header className="app-header">
        <span className="brand">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="brand-icon">
            <path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h5" />
          </svg>
          ResumeCraft
        </span>
        {user && (
          <nav aria-label="문서 메뉴">
            {[
              { path: "/resumes", label: "이력서" },
              { path: "/invoices", label: "견적서" },
            ].map((menu) => (
              <a
                key={menu.path}
                href={menu.path}
                data-testid={`menu-${menu.path.slice(1)}`}
                onClick={(event) => {
                  event.preventDefault();
                  void flushBeforeNavigation()
                    .then(() => navigate(menu.path))
                    .catch((error: Error) => {
                      useToastStore.getState().show(error.message);
                    });
                }}
              >
                {menu.label}
              </a>
            ))}
          </nav>
        )}
        {user && (
          <div className="account">
            <span>{user.nickname}</span>
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={logout}
            >
              로그아웃
            </button>
          </div>
        )}
      </header>
      <main
        id="main-content"
        className={editor ? "editor-content" : "page-content"}
      >
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}
