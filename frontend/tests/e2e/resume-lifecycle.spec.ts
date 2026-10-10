import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`real API resume lifecycle ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const suffix = `${Date.now()}-${mobile ? "mobile" : "desktop"}`;
    const email = `ui-${suffix}@example.org`;
    const password = `Verification-${suffix}`;
    const title = `UI 검증 ${suffix}`;
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
    await page.screenshot({
      path: `evidence/signup-${mobile ? "mobile" : "desktop"}.png`,
    });
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("닉네임", { exact: true }).fill("UI검증");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    await expect(page).toHaveURL(/\/resumes$/);
    await expect(page.getByText("첫 이력서, 여기서 시작하세요.")).toBeVisible();
    await page
      .getByRole("button", { name: "+ 새 이력서", exact: true })
      .click();
    await page.getByRole("textbox", { name: "제목", exact: true }).fill(title);
    await page.getByRole("button", { name: "생성", exact: true }).click();
    await expect(page).toHaveURL(/\/resumes\/[^/]+\/edit$/);
    const id = page.url().split("/").at(-2)!;
    await page.getByLabel("이름", { exact: true }).fill("UI 검증 사용자");
    await page
      .getByLabel("희망 직무", { exact: true })
      .fill("프론트엔드 개발자");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await expect(
      page.getByRole("button", { name: "저장됨", exact: true }),
    ).toBeVisible();
    if (mobile) {
      await page.getByRole("tab", { name: "미리보기", exact: true }).click();
      await expect(page.locator(".resumes-preview")).toBeVisible();
      await page.getByRole("tab", { name: "입력", exact: true }).click();
    }
    await page.screenshot({
      path: `evidence/editor-${mobile ? "mobile" : "desktop"}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "← 목록", exact: true }).click();
    await expect(
      page.getByRole("link", { name: `${title} 편집`, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".resumes-pagination")).not.toContainText("NaN");
    expect(
      await page
        .locator(".resumes-thumbnail")
        .first()
        .evaluate((node) => {
          const renderer = node.querySelector(".resume-renderer")!;
          return Math.abs(
            renderer.getBoundingClientRect().width -
              node.getBoundingClientRect().width,
          );
        }),
    ).toBeLessThan(2);
    await page.screenshot({
      path: `evidence/library-${mobile ? "mobile" : "desktop"}.png`,
    });
    await page
      .getByRole("button", { name: `${title} 메뉴`, exact: true })
      .click();
    await page.getByRole("button", { name: "이름 변경", exact: true }).click();
    await page
      .getByRole("textbox", { name: "제목", exact: true })
      .fill(`${title} 수정`);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(
      page.getByRole("link", { name: `${title} 수정 편집`, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `${title} 수정 메뉴`, exact: true })
      .click();
    await page.getByRole("button", { name: "복제", exact: true }).click();
    await expect(page.locator(".resumes-card")).toHaveCount(2);
    await page.addInitScript(() => {
      window.print = () => {
        document.body.dataset.printInvoked = "true";
      };
    });
    await page.goto(`/print/${id}`);
    await expect(page.locator("body")).toHaveAttribute(
      "data-print-invoked",
      "true",
    );
    await expect(page.locator(".resume-paper").first()).toContainText(
      "UI 검증 사용자",
    );
    await page.goto("/resumes");
    await page
      .getByRole("button", { name: `${title} 수정 메뉴`, exact: true })
      .click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.locator(".resumes-card")).toHaveCount(2);
    await page
      .getByRole("button", { name: `${title} 수정 메뉴`, exact: true })
      .click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
    await expect(page.locator(".resumes-card")).toHaveCount(1);
    // Clean up the test-created duplicate through the actual UI.
    await page.locator(".resumes-card-meta button").click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
    await expect(page.locator(".resumes-card")).toHaveCount(0);
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/resumes$/);
    await page.route("**/api/resumes?*", (route) => route.abort("failed"));
    await page.reload();
    await expect(page.locator(".resumes-feedback")).toBeVisible();
    await page.unroute("**/api/resumes?*");
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByText("첫 이력서, 여기서 시작하세요.")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
