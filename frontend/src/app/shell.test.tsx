import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppRoutes, type Screens } from "./router";
import { useSessionStore } from "./session";
import { ConfirmModal } from "../shared/ConfirmModal";
import { Header } from "../shared/Header";
import { Toast, useToast } from "../shared/Toast";

const screens: Screens = {
  ScLogin: () => <p>로그인 화면</p>,
  ScSignup: () => <p>가입 화면</p>,
  ScResumes: () => <p>목록 화면</p>,
  ScEditor: () => <p>편집 화면</p>,
  ScPrint: () => <p>인쇄 화면</p>,
};
function Location() {
  return <output aria-label="현재 경로">{useLocation().pathname}</output>;
}
function routes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes screens={screens} />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "지우" },
    error: null,
  });
});
afterEach(() => {
  vi.useRealTimers();
  useToast.getState().dismiss();
});

it("root enters the authenticated list route", () => {
  routes("/");
  expect(screen.getByText("목록 화면")).toBeInTheDocument();
});
it("anonymous protected entry redirects to login", () => {
  useSessionStore.getState().clear();
  routes("/resumes");
  expect(screen.getByText("로그인 화면")).toBeInTheDocument();
});
it("authenticated public entry redirects to list", () => {
  routes("/signup");
  expect(screen.getByText("목록 화면")).toBeInTheDocument();
});
it("editor remains a selected-data route", () => {
  routes("/resumes/selected-id/edit");
  expect(screen.getByText("편집 화면")).toBeInTheDocument();
});
it("print is registered without an independent menu or print side effect", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  routes("/print/selected-id");
  expect(screen.getByText("인쇄 화면")).toBeInTheDocument();
  expect(print).not.toHaveBeenCalled();
  print.mockRestore();
});
it("anonymous header has only a non-clickable logo", () => {
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
  expect(screen.getByText("ResumeCraft")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("authenticated header uses nickname and awaits logout flush before moving", async () => {
  let finish: () => void = () => undefined;
  const logout = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <MemoryRouter initialEntries={["/resumes/selected-id/edit"]}>
      <Header nickname="지우" onLogout={logout} />
      <Location />
    </MemoryRouter>,
  );
  expect(screen.getByText("지우")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent(
    "/resumes/selected-id/edit",
  );
  await act(async () => finish());
  await waitFor(() =>
    expect(screen.getByLabelText("현재 경로")).toHaveTextContent("/login"),
  );
});
it("failed logout flush keeps the editor open", async () => {
  render(
    <MemoryRouter initialEntries={["/resumes/selected-id/edit"]}>
      <Header
        nickname="지우"
        onLogout={async () => {
          throw new Error("failed save");
        }}
      />
      <Location />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(useToast.getState().message).not.toBeNull());
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent(
    "/resumes/selected-id/edit",
  );
});
it("cancel and Escape preserve the resource instead of confirming delete", () => {
  const confirm = vi.fn();
  const cancel = vi.fn();
  render(
    <ConfirmModal
      open
      title="이력서 삭제"
      onConfirm={confirm}
      onCancel={cancel}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(confirm).not.toHaveBeenCalled();
});
it("confirmation is explicit and locked while a command is running", () => {
  const confirm = vi.fn();
  render(
    <ConfirmModal
      open
      busy
      title="이력서 삭제"
      onConfirm={confirm}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "삭제 확인" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  expect(confirm).not.toHaveBeenCalled();
});
it("toast appears at the shared host and expires after three seconds", () => {
  vi.useFakeTimers();
  render(<Toast />);
  act(() => useToast.getState().show("저장되었습니다."));
  expect(screen.getByRole("status")).toHaveTextContent("저장되었습니다.");
  act(() => vi.advanceTimersByTime(2999));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
