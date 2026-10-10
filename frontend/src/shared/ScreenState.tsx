import type { ReactNode } from "react";

/** Consistent feedback surface; retries always stay owned by the requesting screen. */
export function ScreenState({
  message,
  error = false,
  action,
}: {
  message: string;
  error?: boolean;
  action?: ReactNode;
}) {
  return (
    <section className={error ? "resumes-feedback" : "resumes-loading"}>
      {!error && <div className="resumes-skeleton" aria-hidden="true" />}
      <p role={error ? "alert" : "status"}>{message}</p>
      {action}
    </section>
  );
}
