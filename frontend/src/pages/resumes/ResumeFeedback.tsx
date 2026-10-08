import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { request, ApiRequestError, type ApiResponse } from "../../shared/http";

export function useResumeFeedback() {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();
  useEffect(() => () => clearTimeout(timer.current), []);
  function toast(text: string) {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), 3000);
  }
  function failure(error: unknown, _dirty = false) {
    if (error instanceof ApiRequestError && error.status === 401) {
      navigate("/login", { replace: true });
    }
    toast(
      error instanceof Error ? error.message : "요청을 처리하지 못했습니다.",
    );
  }
  return { toast, failure, message };
}
export function ResumeToast({ message }: { message: string }) {
  return message ? (
    <div className="resume-toast" role="status">
      {message}
    </div>
  ) : null;
}
export function ResumeDialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const controls = focusable();
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="resume-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className="resume-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function ResumeHeader({
  leave,
}: {
  leave?: (path: string, action?: () => Promise<void>) => void;
}) {
  const [nickname, setNickname] = useState("");
  const navigate = useNavigate();
  const { failure, message } = useResumeFeedback();
  useEffect(() => {
    request<ApiResponse<{ nickname: string }>>("/api/auth/me")
      .then((r) => setNickname(r.data!.nickname))
      .catch((error) => failure(error));
  }, []);
  async function logout() {
    const action = async () => {
      await request("/api/auth/logout", { method: "POST" });
    };
    if (leave) leave("/login", action);
    else {
      try {
        await action();
        navigate("/login", { replace: true });
      } catch (error) {
        failure(error);
      }
    }
  }
  return (
    <header className="resume-header">
      <Link
        to="/resumes"
        onClick={(event) => {
          if (leave) {
            event.preventDefault();
            leave("/resumes");
          }
        }}
      >
        <span className="brand-symbol" aria-hidden="true">
          R
        </span>
        ResumeCraft
      </Link>
      <span>{nickname}</span>
      <button onClick={() => void logout()}>로그아웃</button>
      <ResumeToast message={message} />
    </header>
  );
}
