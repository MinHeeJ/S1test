import { useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "../shared/apiClient";
import "../shared/styles.css";

/** Common application boundary; feature routes supply their real screens as children. */
export function App({ children }: { children?: ReactNode }) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    apiRequest("/api/health").catch(() => {
      if (active)
        setConnectionError("서비스에 연결할 수 없습니다. 다시 시도해 주세요.");
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      {connectionError && <p role="alert">{connectionError}</p>}
      <main id="main-content">{children}</main>
    </>
  );
}
