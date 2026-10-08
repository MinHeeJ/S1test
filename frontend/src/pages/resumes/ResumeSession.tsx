import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../app/AppShell";
import { apiClient, ApiError } from "../../api/apiClient";

/** Actual /me nickname only; navigation and session exit share the editor's flush boundary. */
export function ResumeSession({
  children,
  beforeLeave,
}: {
  children: ReactNode;
  beforeLeave?: () => Promise<void>;
}) {
  const [nickname, setNickname] = useState<string>();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    apiClient
      .get<{ nickname: string }>("/api/auth/me")
      .then((response) => {
        if (active) setNickname(response.data!.nickname);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          navigate("/login", { replace: true });
        else setError("사용자 정보를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [navigate]);
  const logout = async () => {
    try {
      await beforeLeave?.();
      await apiClient.post("/api/auth/logout");
      navigate("/login", { replace: true });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "로그아웃에 실패했습니다.",
      );
    }
  };
  return (
    <div
      onClickCapture={(event) => {
        const link = (event.target as HTMLElement).closest("a");
        if (beforeLeave && link?.getAttribute("href") === "/resumes") {
          event.preventDefault();
          event.stopPropagation();
          void beforeLeave()
            .then(() => navigate("/resumes"))
            .catch(() => undefined);
        }
      }}
    >
      <AppShell nickname={nickname} onLogout={() => void logout()}>
        {error && <p role="alert">{error}</p>}
        {children}
      </AppShell>
    </div>
  );
}
