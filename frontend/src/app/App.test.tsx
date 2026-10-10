import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders supplied feature content within the accessible shared boundary", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, meta: {} })),
      ),
  );
  render(
    <App>
      <h1>내 이력서</h1>
    </App>,
  );
  expect(screen.getByRole("heading", { name: "내 이력서" })).toBeDefined();
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith("/api/health", expect.anything()),
  );
});

it("shows a real failed health request rather than a fabricated success state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  render(<App />);
  expect(await screen.findByRole("alert")).toBeDefined();
});
