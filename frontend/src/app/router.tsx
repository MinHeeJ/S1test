import { useEffect, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  type RouteObject,
} from "react-router-dom";
import { ApiError, setUnauthorizedHandler } from "../api/apiClient";
import { LoginPage } from "../pages/auth/LoginPage";
import { SignupPage } from "../pages/auth/SignupPage";
import { authApi } from "../pages/auth/authApi";
import { ResumeListPage } from "../pages/resumes/ResumeListPage";
import { ResumeEditorLoader } from "../pages/resumes/ResumeEditorLoader";
import { PrintPage } from "../pages/resumes/PrintPage";
import { resumesApi } from "../pages/resumes/resumesApi";
import { getPhoto, photoUrl, uploadPhoto } from "../pages/photos/photosApi";

/** Feature clients depend on the shared transport, never the reverse. */
export const applicationApi = {
  auth: authApi,
  resumes: resumesApi,
  photos: { getPhoto, photoUrl, uploadPhoto },
};

function SessionNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (/^\/resumes\/[^/]+\/edit$/.test(pathname)) {
        window.alert(
          "미저장 변경이 반영되지 않았습니다. 다시 로그인하면 마지막 저장본으로 재개합니다.",
        );
      }
      navigate("/login", { replace: true });
    });
    return () => setUnauthorizedHandler(() => window.location.assign("/login"));
  }, [navigate, pathname]);
  return <Outlet />;
}

/** A failed session check never mounts data-backed screens or invents a user. */
function RequireSession() {
  const [state, setState] = useState<
    "loading" | "authenticated" | "anonymous" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState("loading");
    authApi
      .me()
      .then(() => {
        if (active) setState("authenticated");
      })
      .catch((error: unknown) => {
        if (active)
          setState(
            error instanceof ApiError && error.status === 401
              ? "anonymous"
              : "error",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (state === "anonymous") return <Navigate to="/login" replace />;
  if (state === "loading") return <p role="status">세션 확인 중…</p>;
  if (state === "error")
    return (
      <div role="alert">
        <p>세션을 확인할 수 없습니다.</p>
        <button onClick={() => setAttempt(attempt + 1)}>다시 시도</button>
      </div>
    );
  return <Outlet />;
}

function AuthEntry({
  children,
  signup = false,
}: {
  children: ReactNode;
  signup?: boolean;
}) {
  return (
    <>
      {children}
      <nav aria-label="계정 접근">
        <Link to={signup ? "/login" : "/signup"}>
          {signup ? "로그인" : "회원가입"}
        </Link>
      </nav>
    </>
  );
}

/** Supporting dialogs/actions stay inside their owning screens; print has no menu entry or shell. */
export const applicationRoutes: RouteObject[] = [
  {
    element: <SessionNavigation />,
    children: [
      { path: "/", element: <Navigate to="/resumes" replace /> },
      {
        path: "/login",
        element: (
          <AuthEntry>
            <LoginPage />
          </AuthEntry>
        ),
      },
      {
        path: "/signup",
        element: (
          <AuthEntry signup>
            <SignupPage />
          </AuthEntry>
        ),
      },
      {
        element: <RequireSession />,
        children: [
          { path: "/resumes", element: <ResumeListPage /> },
          { path: "/resumes/:id/edit", element: <ResumeEditorLoader /> },
          { path: "/print/:id", element: <PrintPage /> },
        ],
      },
    ],
  },
];
