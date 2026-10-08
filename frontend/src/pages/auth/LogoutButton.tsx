import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toast } from "../../shared/Toast";
import { authApi } from "./authApi";

/** 인증 shell에서 사용한다. 편집기의 저장 선행 조건은 호출자가 beforeLogout으로 제공한다. */
export function LogoutButton({
  beforeLogout,
}: {
  beforeLogout?: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await beforeLogout?.();
      await authApi.logout();
      navigate("/login", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "로그아웃에 실패했습니다.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        onClick={() => void logout()}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "로그아웃 중…" : "로그아웃"}
      </button>
      {error && (
        <Toast
          message={error}
          tone="error"
          onClose={() => setError(undefined)}
        />
      )}
    </>
  );
}
