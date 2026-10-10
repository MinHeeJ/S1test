import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, ApiError } from "../../shared/apiClient";
import type { Resume } from "../../domain/resume/types";
import "./resumes.css";

let identity: string | undefined;
let draft: { owner: string; resume: Resume } | undefined;
/** Auth wiring supplies its stable login identity; never use nickname as an ownership credential. */
export function setResumeSessionIdentity(value?: string) {
  if (identity && identity !== value) draft = undefined;
  identity = value;
}
export function retainResumeDraft(resume: Resume) {
  if (identity) draft = { owner: identity, resume: structuredClone(resume) };
}
export function restoreResumeDraft(id: string): Resume | undefined {
  if (draft && draft.owner === identity && draft.resume.id === id)
    return structuredClone(draft.resume);
}
export function clearResumeDraft() {
  draft = undefined;
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "요청을 처리할 수 없습니다.";

export function useToast() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [message]);
  return { toast: setMessage, message };
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <div className="resumes-toast" role="status">
      {message}
    </div>
  ) : null;
}

export function ResumeHeader({ flush }: { flush?: () => Promise<void> }) {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, message } = useToast();
  useEffect(() => {
    let active = true;
    apiRequest<{ nickname: string }>("/api/auth/me")
      .then((value) => {
        if (active) setNickname(value.data.nickname);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401)
          navigate("/login");
        else if (active) toast(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [navigate, toast]);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await flush?.();
      await apiRequest("/api/auth/logout", { method: "POST" });
      clearResumeDraft();
      setResumeSessionIdentity(undefined);
      navigate("/login");
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <header className="resumes-header">
      <span className="resumes-brand">ResumeCraft</span>
      <span>{nickname}</span>
      <button disabled={busy} aria-busy={busy} onClick={() => void logout()}>
        로그아웃
      </button>
      <Toast message={message} />
    </header>
  );
}

export function ResumeDialog({
  title,
  busy,
  close,
  children,
}: {
  title: string;
  busy?: boolean;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const original = useRef<Element | null>(null);
  useEffect(() => {
    original.current = document.activeElement;
    const panel = ref.current;
    (
      panel?.querySelector("input,button,select") as HTMLElement | null
    )?.focus();
    return () => {
      (original.current as HTMLElement | null)?.focus();
    };
  }, []);
  return (
    <div
      className="resumes-scrim"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="resumes-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) close();
          if (event.key === "Tab") {
            const controls = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
              ) ?? [],
            );
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2>{title}</h2>
        {children}
        <button disabled={busy} onClick={close}>
          취소
        </button>
      </div>
    </div>
  );
}
