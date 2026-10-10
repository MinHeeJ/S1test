import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ScreenState } from "../../shared/ScreenState";
import { ApiError } from "../../shared/apiClient";
import { getCurrentUser } from "./authApi";

/** Protects rendered children without discarding the parent's in-memory draft on expiry. */
export function AuthBoundary({
  children,
  onSessionExpired,
}: {
  children: ReactNode;
  onSessionExpired?: () => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const notifyPrint = (message: string) => {
      if (pathname.startsWith("/print/")) {
        window.parent.postMessage(
          { type: "resume-print-error", message },
          window.location.origin,
        );
      }
    };
    const expire = () => {
      if (!active) return;
      setReady(false);
      notifyPrint("로그인이 필요합니다. 다시 로그인해 주세요.");
      onSessionExpired?.();
      navigate("/login", { replace: true });
    };
    window.addEventListener("session-expired", expire);
    setError("");
    getCurrentUser()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401) expire();
        else {
          notifyPrint("로그인 상태를 확인할 수 없습니다.");
          setError("로그인 상태를 확인할 수 없습니다.");
        }
      });
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
    };
  }, [navigate, onSessionExpired, attempt, pathname]);
  if (error)
    return (
      <ScreenState
        error
        message={error}
        action={
          <button onClick={() => setAttempt((value) => value + 1)}>
            다시 시도
          </button>
        }
      />
    );
  if (!ready) return <ScreenState message="로그인 상태 확인 중…" />;
  return <>{children}</>;
}
