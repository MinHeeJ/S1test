import { useEffect } from "react";

export type ToastProps = {
  message: string;
  onClose: () => void;
  tone?: "success" | "error";
};
/** 사용자 결과는 하단에서 3초 동안 표시한다. */
export function Toast({ message, onClose, tone = "success" }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return (
    <div
      className={`toast toast-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
