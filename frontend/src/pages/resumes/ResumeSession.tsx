import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, ApiRequestError } from "../../shared/apiClient";
import { Icon } from "../../shared/Icon";

/** Feature header consumes sibling session APIs; it never imports authentication implementation details. */
export function ResumeSession({
  children,
  beforeExit,
  notify,
}: {
  children: ReactNode;
  beforeExit?: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [nickname, setNickname] = useState<string>();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void apiClient
      .get<{ nickname: string }>("/api/auth/me")
      .then((result) => {
        if (active) setNickname(result.data?.nickname);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiRequestError && error.status === 401)
          navigate("/login");
        else notify("세션 정보를 가져오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [navigate, notify]);
  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await beforeExit?.();
      await apiClient.post("/api/auth/logout");
      navigate("/login");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        notify("세션이 만료되었습니다. 다시 로그인해 주세요.");
        navigate("/login");
      } else notify("저장 또는 로그아웃에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="resume-app">
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <header className="app-header">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="document" size={20} />
          </span>
          ResumeCraft
        </span>
        {nickname && (
          <>
            <span className="session-identity">
              <span className="user-avatar" aria-hidden="true">
                {nickname.slice(0, 1)}
              </span>
              <span>{nickname}</span>
            </span>
            <button
              className="logout-button secondary"
              disabled={busy}
              onClick={() => void logout()}
            >
              <Icon name="logout" />
              로그아웃
            </button>
          </>
        )}
      </header>
      {children}
    </div>
  );
}
