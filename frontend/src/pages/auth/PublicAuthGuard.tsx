import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ApiError } from "../../api/apiClient";
import { authApi } from "./authApi";

/** 공개 인증 화면에서도 서버 세션 확인 전 폼을 노출하지 않는다. */
export function PublicAuthGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    "loading" | "anonymous" | "authenticated" | "error"
  >("loading");
  useEffect(() => {
    let active = true;
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
  }, []);
  if (state === "authenticated") return <Navigate to="/resumes" replace />;
  if (state === "loading") return <p role="status">세션 확인 중…</p>;
  if (state === "error")
    return <p role="alert">세션을 확인할 수 없습니다. 다시 접속해주세요.</p>;
  return <>{children}</>;
}
