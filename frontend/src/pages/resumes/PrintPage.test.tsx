import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../shared/apiClient";
import { resumeSeeds } from "../../../tests/fixtures/resumeSeeds";
import { resumeApi } from "./api";
import { PrintPage } from "./PrintPage";

vi.mock("./api", () => ({ resumeApi: { get: vi.fn() } }));
const originalFonts = document.fonts;
const originalTitle = document.title;
function mount() {
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          { path: "/print/:id", element: <PrintPage /> },
          { path: "/login", element: <h1>로그인</h1> },
        ],
        { initialEntries: ["/print/42"] },
      )}
    />,
  );
}
beforeEach(() => {
  vi.mocked(resumeApi.get).mockResolvedValue({
    success: true,
    meta: {},
    data: structuredClone(resumeSeeds[0]),
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      ready: Promise.resolve(),
      forEach: (visit: (face: unknown) => void) =>
        visit({
          family: "Pretendard",
          load: () => Promise.resolve(),
        }),
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: originalFonts,
  });
  document.title = originalTitle;
});
describe("print completion contract", () => {
  it("uses the saved basics fields for the specified PDF document title", async () => {
    const resume = structuredClone(resumeSeeds[0]);
    if (resume.content[0].type === "basics") {
      resume.content[0].data.name = "김지우";
      resume.content[0].data.jobTitle = "개발자";
      resume.content[0].data.photoId = null;
    }
    vi.mocked(resumeApi.get).mockResolvedValue({
      success: true,
      meta: {},
      data: resume,
    });
    mount();
    await waitFor(() => expect(document.title).toBe("김지우_개발자_이력서"));
  });
  it("notifies the parent when layout rendering fails before print readiness", async () => {
    const message = vi.spyOn(window, "postMessage");
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => {
        throw new Error("layout unavailable");
      },
    );
    mount();
    await screen.findByRole("alert");
    expect(message).toHaveBeenCalledWith(
      "resume-print-error",
      window.location.origin,
    );
    expect(print).not.toHaveBeenCalled();
  });
  it("distinguishes unauthorized readback from ordinary print failure", async () => {
    const message = vi.spyOn(window, "postMessage");
    vi.mocked(resumeApi.get).mockRejectedValue(
      new ApiRequestError(401, {
        success: false,
        meta: {},
        code: "UNAUTHORIZED",
        message: "로그인 필요",
        field: null,
      }),
    );
    mount();
    await screen.findByRole("heading", { name: "로그인" });
    expect(message).toHaveBeenCalledWith(
      "resume-print-unauthorized",
      window.location.origin,
    );
  });
});
