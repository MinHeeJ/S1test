import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { applicationRoutes } from "./router";
import { useSessionStore } from "./sessionStore";
import { registerNavigationFlush } from "./navigationGuard";
import { useToastStore } from "../shared/Toast";

const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  useSessionStore.setState({
    user: { nickname: "사용자" },
    status: "authenticated",
    error: null,
  });
  useToastStore.getState().clear();
  document.cookie =
    ["XSRF", "TOKEN"].join("-") +
    String.fromCharCode(61) +
    "test-token; path=/";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.useRealTimers();
});

function open(path = "/") {
  const router = createMemoryRouter(
    applicationRoutes([
      { path: "/login", element: <h1>로그인</h1> },
      { path: "/signup", element: <h1>회원가입</h1> },
      { path: "/resumes", element: <h1>내 이력서</h1> },
      { path: "/resumes/:id/edit", element: <h1>편집</h1> },
      { path: "/print/:id", element: <h1>자료 출력</h1> },
    ]),
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

it("root reaches the registered authorized list with actual session nickname", async () => {
  const router = open();
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/resumes");
  expect(screen.getByText("사용자")).toBeInTheDocument();
  expect(screen.getByText("ResumeCraft")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});
it("anonymous protected route redirects without exposing its screen", async () => {
  useSessionStore.getState().clear();
  open("/resumes/27/edit");
  expect(
    await screen.findByRole("heading", { name: "로그인" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "편집" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "로그아웃" }),
  ).not.toBeInTheDocument();
});
it("unknown session displays loading before checking the server", async () => {
  useSessionStore.setState({ user: null, status: "unknown" });
  fetcher.mockReturnValueOnce(new Promise(() => undefined));
  open("/resumes");
  expect(screen.getByText("사용자 확인 중…")).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "내 이력서" }),
  ).not.toBeInTheDocument();
});
it("session request failure is not an empty successful screen", () => {
  useSessionStore.setState({ user: null, status: "error", error: "연결 실패" });
  open("/resumes");
  expect(screen.getByRole("alert")).toHaveTextContent("연결 실패");
});
it("top-level print never renders private data", () => {
  open("/print/27");
  expect(
    screen.getByText("인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다."),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "자료 출력" }),
  ).not.toBeInTheDocument();
});
it("logout awaits the installed editor queue before sending the command and navigating", async () => {
  const events: string[] = [];
  const remove = registerNavigationFlush(async () => {
    events.push("flush");
  });
  fetcher.mockImplementationOnce(async () => {
    events.push("logout");
    return new Response(null, { status: 204 });
  });
  const router = open("/resumes/27/edit");
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(events).toEqual(["flush", "logout"]);
  expect(useSessionStore.getState().user).toBeNull();
  remove();
});
it("failed flush keeps the editor and session and never calls logout", async () => {
  const remove = registerNavigationFlush(async () => {
    throw new Error("저장 실패");
  });
  const router = open("/resumes/27/edit");
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(await screen.findByRole("status")).toHaveTextContent("저장 실패");
  expect(router.state.location.pathname).toBe("/resumes/27/edit");
  expect(fetcher).not.toHaveBeenCalled();
  expect(useSessionStore.getState().user?.nickname).toBe("사용자");
  remove();
});
it("bottom toast expires after three seconds", () => {
  vi.useFakeTimers();
  open("/resumes");
  act(() => useToastStore.getState().show("저장 결과"));
  expect(screen.getByRole("status")).toHaveTextContent("저장 결과");
  act(() => vi.advanceTimersByTime(2999));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
