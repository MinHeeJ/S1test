import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useSessionStore } from "./sessionStore";

export function ProtectedRoute() {
  const { status, refresh, error } = useSessionStore();
  useEffect(() => {
    if (status === "unknown") void refresh();
  }, [status, refresh]);
  if (status === "anonymous") return <Navigate to="/login" replace />;
  if (status === "error") return <p role="alert">{error}</p>;
  if (status !== "authenticated") return <p role="status">사용자 확인 중…</p>;
  return <Outlet />;
}
