import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ResumeApiError, resumeRequest } from "./resumeApi";
import { LogoutButton } from "../auth/LogoutButton";

export function ResumeDialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>("input, button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab" && dialog) {
        const controls = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "input, button, select, textarea, a",
          ),
        ).filter((element) => !element.hasAttribute("disabled"));
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? index - 1 : index + 1;
        if (next < 0 || next >= controls.length) {
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [close]);
  return (
    <div className="resume-scrim">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="resume-dialog"
      >
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={close}>
          취소
        </button>
      </section>
    </div>
  );
}
export function ResumeToast({
  message,
  clear,
}: {
  message: string;
  clear: () => void;
}) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(clear, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, clear]);
  return message ? (
    <div className="resume-toast" role="status">
      {message}
    </div>
  ) : null;
}

/** Product-local session surface; route composition remains owned by the shared shell. */
export function ResumeSession({
  children,
  beforeExit,
}: {
  children: ReactNode;
  beforeExit?: () => Promise<void>;
}) {
  const [nickname, setNickname] = useState("");
  const { pathname } = useLocation();

  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    resumeRequest<{ nickname: string }>("/api/auth/me")
      .then((user) => {
        if (active) setNickname(user.nickname);
      })
      .catch((error) => {
        if (active && error instanceof ResumeApiError && error.status === 401)
          navigate("/login");
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="resume-shell">
      <a className="resume-skip" href="#resume-main">
        본문으로 이동
      </a>
      <aside className="resume-nav">
        <Link
          className="resume-brand"
          to="/resumes"
          onClick={(event) => {
            if (beforeExit) {
              event.preventDefault();
              void beforeExit()
                .then(() => navigate("/resumes"))
                .catch(() => undefined);
            }
          }}
        >
          ◈ <span>ResumeCraft</span>
        </Link>
        <Link
          to="/resumes"
          aria-current={pathname === "/resumes" ? "page" : undefined}
          onClick={(event) => {
            if (beforeExit) {
              event.preventDefault();
              void beforeExit()
                .then(() => navigate("/resumes"))
                .catch(() => undefined);
            }
          }}
        >
          ▤ <span>내 이력서</span>
        </Link>
        <footer>
          <div className="resume-account">
            <span className="resume-avatar" aria-hidden="true">
              {nickname.slice(0, 1)}
            </span>
            <span>{nickname}</span>
          </div>
          <LogoutButton beforeLogout={beforeExit} />
        </footer>
      </aside>
      <main id="resume-main">{children}</main>
    </div>
  );
}
