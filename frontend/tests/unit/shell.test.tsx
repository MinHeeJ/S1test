import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../../src/app/AppShell";

describe("shared shell navigation", () => {
  it("makes the authorized resume entry reachable through the product navigation", () => {
    render(
      <AppShell nickname="지우">
        <h1>이력서</h1>
      </AppShell>,
    );
    expect(
      screen.getByRole("navigation", { name: "주 메뉴" }),
    ).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "주 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "내 이력서" }),
    ).toHaveAttribute("href", "/resumes");
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "이력서" }),
    );
  });

  it("does not show authenticated navigation for an anonymous screen", () => {
    render(
      <AppShell>
        <h1>로그인</h1>
      </AppShell>,
    );
    expect(
      screen.queryByRole("navigation", { name: "주 메뉴" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "모바일 메뉴" }),
    ).not.toBeInTheDocument();
  });
});
