import { useEffect, useState, type ReactNode } from "react";
import {
  Navigate,
  useLocation,
  useRoutes,
  type RouteObject,
} from "react-router-dom";
import { LoginPage } from "../pages/auth/LoginPage";
import { SignupPage } from "../pages/auth/SignupPage";
import { authApi } from "../api/apiClient";
import { resumeRoutes } from "../pages/resumes/resumeRoutes";
import { ApiRequestError } from "../shared/http";

// Public entries consumed by the product router without feature-to-router imports.
export const authRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
];

/** Checks the current session before mounting a protected screen; never stores credentials locally. */
function SessionEntry({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    "loading" | "ready" | "anonymous" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState("loading");
    authApi
      .getCurrentUser()
      .then(() => {
        if (active) setState("ready");
      })
      .catch((error: unknown) => {
        if (active)
          setState(
            error instanceof ApiRequestError && error.status === 401
              ? "anonymous"
              : "error",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (state === "anonymous") return <Navigate to="/login" replace />;
  if (state === "error")
    return (
      <main className="resume-product" role="alert">
        <p>로그인 상태를 확인하지 못했습니다.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          다시 시도
        </button>
      </main>
    );
  if (state === "loading") return <p role="status">로그인 상태 확인 중…</p>;
  return <>{children}</>;
}

function ProtectedScreen({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <SessionEntry key={location.pathname}>{children}</SessionEntry>;
}

/** Five physical screens; dialogs, style, photo and session controls stay inside their owning screens. */
export const applicationRoutes: RouteObject[] = [
  { path: "/", element: <Navigate to="/resumes" replace /> },
  ...authRoutes,
  ...resumeRoutes.map((route) => ({
    ...route,
    element: <ProtectedScreen>{route.element}</ProtectedScreen>,
  })),
  { path: "*", element: <Navigate to="/resumes" replace /> },
];

export function ApplicationRoutes() {
  return useRoutes(applicationRoutes);
}
