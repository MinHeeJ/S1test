import { create } from "zustand";
import { useEffect } from "react";

interface ToastState {
  message: string | null;
  version: number;
  show: (message: string) => void;
  dismiss: () => void;
}
export const useToast = create<ToastState>((set) => ({
  message: null,
  version: 0,
  show: (message) => set((state) => ({ message, version: state.version + 1 })),
  dismiss: () => set({ message: null }),
}));

export function Toast() {
  const { message, version, dismiss } = useToast();
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(dismiss, 3000);
    return () => window.clearTimeout(timeout);
  }, [message, version, dismiss]);
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
}
