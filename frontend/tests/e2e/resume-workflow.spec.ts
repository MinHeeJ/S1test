import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/** Real session/CSRF and database APIs; no intercepted responses or seeded UI data. */
test("가입 → 생성 → 직렬 저장 → 목록 → 이름 변경/복제/삭제 → 재로그인", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `ui-${randomUUID()}@example.test`;
  const password = randomUUID();
  const title = `검증 ${randomUUID().slice(0, 8)}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("login.png") });
  await page
    .locator(".auth-panel")
    .getByRole("link", { name: "회원가입" })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("닉네임", { exact: true }).fill("UI검증");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(page.locator(".library-empty")).toBeVisible();
  await page.getByRole("button", { name: "+ 새 이력서", exact: true }).click();
  let modal = page.getByRole("dialog", { name: "새 이력서", exact: true });
  await expect(modal.getByLabel("제목")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await page.getByRole("button", { name: "+ 새 이력서", exact: true }).click();
  modal = page.getByRole("dialog", { name: "새 이력서", exact: true });
  await modal.getByLabel("제목").fill(title);
  await modal.getByRole("button", { name: "생성", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes\/[^/]+\/edit$/);
  await page.getByLabel("이름", { exact: true }).fill("검증 사용자");
  await page.getByLabel("희망 직무", { exact: true }).fill("제품 디자이너");
  await expect(
    page.getByRole("button", { name: "저장됨", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("editor-desktop.png") });
  for (const width of [1024, 1023, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1024) {
      await expect(page.locator(".mobile-editor-tabs")).toBeVisible();
      await page
        .locator(".mobile-editor-tabs")
        .getByRole("button", { name: "미리보기" })
        .click();
      await expect(page.locator(".editor-preview")).toBeVisible();
      await page
        .locator(".mobile-editor-tabs")
        .getByRole("button", { name: "입력" })
        .click();
    } else {
      await expect(page.locator(".mobile-editor-tabs")).not.toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.screenshot({ path: test.info().outputPath("editor-mobile.png") });
  await page.getByRole("button", { name: "← 목록", exact: true }).click();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: test.info().outputPath("library.png") });
  let card = page
    .locator(".resume-card")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "이름 변경" }).click();
  modal = page.getByRole("dialog", { name: "이름 변경", exact: true });
  const renamed = `${title} 수정`;
  await modal.getByLabel("제목").fill(renamed);
  await modal.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("link", { name: renamed, exact: true }),
  ).toBeVisible();
  card = page
    .locator(".resume-card")
    .filter({ has: page.getByRole("link", { name: renamed, exact: true }) });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "복제", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `${renamed} (사본)`, exact: true }),
  ).toBeVisible();
  for (const name of [`${renamed} (사본)`, renamed]) {
    card = page
      .locator(".resume-card")
      .filter({ has: page.getByRole("link", { name, exact: true }) });
    await card.locator("summary").click();
    await card.getByRole("button", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "취소", exact: true })
      .click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    await card.getByRole("button", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "삭제", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name, exact: true }),
    ).not.toBeVisible();
  }
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(page.locator(".library-empty")).toBeVisible();
  expect(errors).toEqual([]);
});
