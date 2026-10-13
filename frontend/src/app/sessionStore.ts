import { create } from "zustand";
import { apiRequest } from "../shared/apiClient";
import type { CurrentUser } from "../shared/contracts";

type SessionState = {
  user: CurrentUser | null;
  status: "unknown" | "loading" | "authenticated" | "anonymous" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  clear: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  status: "unknown",
  error: null,
  refresh: async () => {
    set({ status: "loading", error: null });
    try {
      const user = await apiRequest<CurrentUser>("/api/auth/me");
      if (typeof user.nickname !== "string")
        throw new Error("사용자 응답 계약 오류");
      set({ user, status: "authenticated" });
    } catch (error) {
      const status =
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 401
          ? "anonymous"
          : "error";
      set({
        user: null,
        status,
        error: error instanceof Error ? error.message : "사용자 확인 실패",
      });
    }
  },
  clear: () => set({ user: null, status: "anonymous", error: null }),
}));
