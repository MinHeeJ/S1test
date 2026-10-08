import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthApiError, getCurrentUser } from "../api/apiClient";
import { LoginPage } from "../pages/auth/LoginPage";
import { SignupPage } from "../pages/auth/SignupPage";
import { PhotoPicker } from "../pages/photos/PhotoPicker";
import { ResumeEditorPage } from "../pages/resumes/ResumeEditorPage";
import { ResumeListPage } from "../pages/resumes/ResumeListPage";
import { ResumePrintPage } from "../pages/resumes/ResumePrintPage";

type SessionState = "loading" | "authenticated" | "anonymous" | "failed";

/** Check the session before mounting private pages; leaving a route drops its private state. */
function SessionBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [result, setResult] = useState<{ path: string; state: SessionState }>({
    path: pathname,
    state: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult({ path: pathname, state: "loading" });
    void getCurrentUser()
      .then(() => {
        if (active) setResult({ path: pathname, state: "authenticated" });
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof AuthApiError && error.status === 401) {
          window.alert(
            "세션이 만료되었습니다. 저장되지 않은 변경 사항이 있을 수 있습니다.",
          );
          setResult({ path: pathname, state: "anonymous" });
        } else setResult({ path: pathname, state: "failed" });
      });
    return () => {
      active = false;
    };
  }, [pathname, attempt]);
  const state = result.path === pathname ? result.state : "loading";
  if (state === "anonymous") return <Navigate to="/login" replace />;
  if (state === "failed")
    return (
      <main>
        <p role="alert">세션을 확인하지 못했습니다.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          다시 시도
        </button>
      </main>
    );
  if (state === "loading") return <p role="status">세션 확인 중…</p>;
  return <>{children}</>;
}

/** Five real screens; create/rename/delete/style/photo remain existing in-screen actions. */
export function ApplicationRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/resumes" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/resumes"
        element={
          <SessionBoundary>
            <ResumeListPage />
          </SessionBoundary>
        }
      />
      <Route
        path="/resumes/:id/edit"
        element={
          <SessionBoundary>
            <ResumeEditorPage
              renderPhoto={(photoId, onPhotoChange) => (
                <PhotoPicker photoId={photoId} onPhotoChange={onPhotoChange} />
              )}
            />
          </SessionBoundary>
        }
      />
      <Route
        path="/print/:id"
        element={
          <SessionBoundary>
            <ResumePrintPage />
          </SessionBoundary>
        }
      />
      <Route path="*" element={<Navigate to="/resumes" replace />} />
    </Routes>
  );
}

export function ApplicationRouter() {
  return (
    <BrowserRouter>
      <ApplicationRoutes />
    </BrowserRouter>
  );
}
