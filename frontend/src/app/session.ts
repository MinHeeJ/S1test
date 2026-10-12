import { create } from "zustand";
import { ApiError, apiRequest } from "../shared/api";

export interface CurrentUser {
  nickname: string;
}
export type SessionStatus = "loading" | "authenticated" | "anonymous" | "error";
interface SessionState {
  status: SessionStatus;
  user: CurrentUser | null;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
}

/** Memory-only UI state; the HttpOnly session cookie remains the authentication authority. */
export const useSessionStore = create<SessionState>((set) => ({
  status: "loading",
  user: null,
  error: null,
  async load() {
    set({ status: "loading", user: null, error: null });
    try {
      const user = await apiRequest<CurrentUser>("/api/auth/me", {
        notify: false,
      });
      if (typeof user?.nickname !== "string" || !user.nickname.trim()) {
        throw new Error("사용자 응답을 확인하지 못했습니다.");
      }
      set({ status: "authenticated", user, error: null });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        set({ status: "anonymous", user: null, error: null });
      } else {
        set({
          status: "error",
          user: null,
          error: "사용자 정보를 확인하지 못했습니다.",
        });
      }
    }
  },
  clear: () => set({ status: "anonymous", user: null, error: null }),
}));
