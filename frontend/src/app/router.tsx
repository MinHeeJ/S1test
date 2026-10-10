import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  useRoutes,
  type RouteObject,
} from "react-router-dom";
import { AuthBoundary } from "../pages/auth/AuthBoundary";
import { authRoutes } from "../pages/auth/authRoutes";
import { PhotoPanel } from "../pages/photos/PhotoPanel";
import { ResumeEditorPage } from "../pages/resumes/ResumeEditorPage";
import { ResumeListPage } from "../pages/resumes/ResumeListPage";
import { ResumePrintPage } from "../pages/resumes/ResumePrintPage";
import {
  clearResumeDraft,
  setResumeSessionIdentity,
} from "../pages/resumes/ResumeSession";

/** Five product screens; supporting dialogs/settings remain inside their owning screen. */
export const routes: RouteObject[] = [
  ...authRoutes,
  { path: "/", element: <Navigate to="/resumes" replace /> },
  {
    path: "/resumes",
    element: (
      <AuthBoundary>
        <ResumeListPage />
      </AuthBoundary>
    ),
  },
  {
    path: "/resumes/:id/edit",
    element: (
      <AuthBoundary>
        <ResumeEditorPage
          photoControl={(photoId, onPhotoChange) => (
            <PhotoPanel photoId={photoId} onPhotoChange={onPhotoChange} />
          )}
        />
      </AuthBoundary>
    ),
  },
  {
    path: "/print/:id",
    element: (
      <AuthBoundary>
        <ResumePrintPage />
      </AuthBoundary>
    ),
  },
];

/** Connects successful authentication to memory-only draft ownership, not display nickname. */
export function ApplicationRoutes() {
  useEffect(() => {
    const identify = (event: Event) => {
      const email: unknown = (event as CustomEvent<unknown>).detail;
      if (typeof email === "string") setResumeSessionIdentity(email);
    };
    const logout = () => {
      clearResumeDraft();
      setResumeSessionIdentity(undefined);
    };
    window.addEventListener("session-identity", identify);
    window.addEventListener("session-logged-out", logout);
    return () => {
      window.removeEventListener("session-identity", identify);
      window.removeEventListener("session-logged-out", logout);
    };
  }, []);
  // Expiry leaves identity intact; the editor retains its latest dirty draft before unmounting.
  return useRoutes(routes);
}

export function ApplicationRouter() {
  return (
    <BrowserRouter>
      <ApplicationRoutes />
    </BrowserRouter>
  );
}
