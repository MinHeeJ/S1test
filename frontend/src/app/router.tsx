import { useEffect, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  useLocation,
  type RouteObject,
} from "react-router-dom";
import { LoginPage } from "../pages/auth/LoginPage";
import { SignupPage } from "../pages/auth/SignupPage";
import { getCurrentUser } from "../api/apiClient";
import { ApiRequestError } from "../shared/apiClient";
import { resumeRoutes } from "../pages/resumes/routes";
import "./app.css";

export const authRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
];

function AccountPage({ children }: { children: ReactNode }) {
  return (
    <div className="account-shell">
      <header className="account-brand">
        <span className="brand">ResumeCraft</span>
      </header>
      <main id="main-content">
        {children}
        <nav className="account-navigation" aria-label="계정">
          <Link to="/login">로그인</Link>
          {" · "}
          <Link to="/signup">회원가입</Link>
        </nav>
      </main>
    </div>
  );
}

/** Check the session before mounting protected data; the feature owns its header and save queue. */
function SessionBoundary({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    "loading" | "ready" | "anonymous" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();
  const embeddedPrint =
    location.pathname.startsWith("/print/") && window.parent !== window;
  useEffect(() => {
    let active = true;
    setState("loading");
    void getCurrentUser()
      .then(() => {
        if (active) setState("ready");
      })
      .catch((error) => {
        if (!active) return;
        if (embeddedPrint)
          window.parent.postMessage(
            error instanceof ApiRequestError && error.status === 401
              ? "resume-print-unauthorized"
              : "resume-print-error",
            window.location.origin,
          );
        setState(
          error instanceof ApiRequestError && error.status === 401
            ? "anonymous"
            : "error",
        );
      });
    return () => {
      active = false;
    };
  }, [attempt, embeddedPrint]);
  if (state === "ready") return children;
  if (state === "anonymous" && !embeddedPrint)
    return <Navigate to="/login" replace />;
  return (
    <main className="page-content">
      {state === "loading" ? (
        <p role="status">세션 확인 중…</p>
      ) : (
        <section>
          <p role="alert">
            {state === "anonymous"
              ? "로그인이 필요합니다."
              : "세션을 확인하지 못했습니다."}
          </p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            다시 시도
          </button>
        </section>
      )}
    </main>
  );
}

/** Five physical screens only: supporting dialogs, style and photo controls stay within their features. */
export const appRoutes: RouteObject[] = [
  { path: "/", element: <Navigate to="/resumes" replace /> },
  ...authRoutes.map((route) => ({
    ...route,
    element: <AccountPage>{route.element}</AccountPage>,
  })),
  ...resumeRoutes.map((route) => ({
    ...route,
    element: (
      <SessionBoundary key={route.path}>{route.element}</SessionBoundary>
    ),
  })),
  {
    path: "*",
    element: (
      <main className="page-content">
        <p role="alert">자료를 찾을 수 없습니다.</p>
      </main>
    ),
  },
];
