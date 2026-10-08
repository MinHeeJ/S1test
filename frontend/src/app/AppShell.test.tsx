import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { Toast } from "../shared/Toast";

describe("공통 제품 shell", () => {
  it("공개 화면에는 nickname/로그아웃을 표시하지 않는다", () => {
    render(
      <MemoryRouter>
        <AppShell>
          <h1>로그인</h1>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.queryByText("로그아웃")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "로그인" })).toBeVisible();
  });
  it("인증된 사용자 헤더의 로고로 실제 목록 route에 접근한다", () => {
    render(
      <MemoryRouter initialEntries={["/editor"]}>
        <Routes>
          <Route
            path="/editor"
            element={<AppShell nickname="지우">편집 내용</AppShell>}
          />
          <Route path="/resumes" element={<h1>나의 이력서</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "ResumeCraft" }));
    expect(screen.getByRole("heading", { name: "나의 이력서" })).toBeVisible();
  });
  it("로그아웃은 전달된 session action을 호출한다", () => {
    const logout = vi.fn();
    render(
      <MemoryRouter>
        <AppShell nickname="민준" onLogout={logout}>
          목록
        </AppShell>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(logout).toHaveBeenCalledOnce();
  });
  it("오류 토스트는 3초 후 닫힌다", () => {
    vi.useFakeTimers();
    try {
      const close = vi.fn();
      render(<Toast message="저장 실패" tone="error" onClose={close} />);
      expect(screen.getByRole("alert")).toHaveTextContent("저장 실패");
      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(close).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
