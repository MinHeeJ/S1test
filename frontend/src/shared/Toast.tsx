import { useEffect } from "react";
import { create } from "zustand";

export const useToastStore = create<{
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
}>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));

export function Toast() {
  const { message, clear } = useToastStore();
  useEffect(() => {
    if (message === null) return;
    const timer = window.setTimeout(clear, 3000);
    return () => window.clearTimeout(timer);
  }, [message, clear]);
  return message === null ? null : (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
