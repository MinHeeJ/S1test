import type { ComponentType } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useSessionStore } from "./session";
import { ScLogin } from "../pages/auth/ScLogin";
import { ScSignup } from "../pages/auth/ScSignup";
import { ScResumes } from "../pages/resumes/ScResumes";
import { ScEditor } from "../pages/resumes/ScEditor";
import { ScPrint } from "../pages/resumes/ScPrint";

/** Product screens share the existing session, transport and feature-owned modal flows. */
export const registeredScreens: Screens = {
  ScLogin,
  ScSignup,
  ScResumes,
  ScEditor,
  ScPrint,
};

export interface Screens {
  ScLogin: ComponentType;
  ScSignup: ComponentType;
  ScResumes: ComponentType;
  ScEditor: ComponentType;
  ScPrint: ComponentType;
}

function SessionBoundary({ publicOnly = false }: { publicOnly?: boolean }) {
  const { status, error } = useSessionStore();
  if (status === "loading")
    return <p role="status">사용자 정보를 확인하고 있습니다…</p>;
  if (status === "error")
    return <p role="alert">{error} 페이지를 새로고침해 주세요.</p>;
  if (publicOnly && status === "authenticated")
    return <Navigate to="/resumes" replace />;
  if (!publicOnly && status === "anonymous")
    return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** The registration owner passes actual feature screens; this module never imports a shared client registry. */
export function AppRoutes({ screens }: { screens: Screens }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/resumes" replace />} />
      <Route element={<SessionBoundary publicOnly />}>
        <Route path="/login" element={<screens.ScLogin />} />
        <Route path="/signup" element={<screens.ScSignup />} />
      </Route>
      <Route element={<SessionBoundary />}>
        <Route path="/resumes" element={<screens.ScResumes />} />
        <Route path="/resumes/:id/edit" element={<screens.ScEditor />} />
        <Route path="/print/:id" element={<screens.ScPrint />} />
      </Route>
      <Route
        path="*"
        element={<p role="alert">페이지를 찾을 수 없습니다.</p>}
      />
    </Routes>
  );
}
