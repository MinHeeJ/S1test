import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Real session + PostgreSQL-backed APIs. No fabricated HTTP responses or document fixtures.
async function register(page: Page) {
  const email = `ui-${randomBytes(8).toString("hex")}@example.test`;
  const password = randomBytes(18).toString("base64url");
  await page.goto("/signup");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("닉네임", { exact: true }).fill("UI검증");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  return { email, password };
}

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "+ 새 이력서", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "새 이력서", exact: true });
  await dialog.getByLabel("제목").fill(title);
  await dialog.getByLabel("템플릿").selectOption("modern");
  await dialog.getByRole("button", { name: "생성", exact: true }).click();
  await expect(page.getByLabel("희망 직무")).toBeVisible();
}

async function menu(page: Page, title: string) {
  const card = page
    .locator(".resume-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card.locator("summary").click();
  return card;
}

test("가입 → 생성 → 자동저장 → 재조회 → 출력 → 이름·복제·삭제 → 로그인", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const credentials = await register(page);
  await expect(page.getByText("첫 이력서를 만들어 보세요.")).toBeVisible();
  await create(page, "UI 검증 문서");
  const editURL = page.url();
  const id = editURL.split("/").at(-2)!;
  await page.getByLabel("이름", { exact: true }).fill("검증 사용자");
  await page.getByLabel("희망 직무").fill("제품 디자이너");
  await expect(page.locator(".resume-save-status")).toHaveText("저장됨");
  await page
    .getByRole("button", { name: "템플릿·스타일", exact: true })
    .click();
  await expect(page.getByLabel("희망 직무")).toHaveCount(0);
  await page.getByRole("combobox", { name: /^템플릿/ }).selectOption("classic");
  await page.getByRole("button", { name: "#0F766E", exact: true }).click();
  await expect(page.locator(".resume-save-status")).toHaveText("저장됨");
  await page.reload();
  await expect(page.getByLabel("희망 직무")).toHaveValue("제품 디자이너");
  const saved = await page.request.get(`/api/resumes/${id}`);
  expect(saved.ok()).toBeTruthy();
  expect((await saved.json()).data.style.color).toBe("#0F766E");
  await page.screenshot({ path: "test-results/editor-desktop.png" });

  // Exercise the existing iframe-only route without opening a native print dialog.
  const printPage = await page.context().newPage();
  await printPage.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printCalled = "true";
    };
  });
  await printPage.goto(`/print/${id}`);
  await expect(printPage.locator("html")).toHaveAttribute(
    "data-print-called",
    "true",
  );
  await expect(printPage.locator(".resume-nav")).toHaveCount(0);
  await printPage.close();

  await page.getByRole("button", { name: "← 목록", exact: true }).click();
  let card = await menu(page, "UI 검증 문서");
  await card.getByRole("button", { name: "이름 변경", exact: true }).click();
  await page.getByRole("dialog").getByLabel("제목").fill("이름 변경 검증");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "이름 변경 검증", exact: true }),
  ).toBeVisible();
  card = await menu(page, "이름 변경 검증");
  await card.getByRole("button", { name: "복제", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이름 변경 검증 (사본)", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/library-desktop.png" });
  for (const title of ["이름 변경 검증 (사본)", "이름 변경 검증"]) {
    card = await menu(page, title);
    await card.getByRole("button", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "취소", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "삭제 확인", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
  }
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("이메일", { exact: true }).fill(credentials.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByText("첫 이력서를 만들어 보세요.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile 및 1023/1024px 경계, 문서 맞춤, 실제 네트워크 실패·재시도", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  await create(page, "반응형 검증 문서");
  await expect(page.locator(".resume-preview-panel")).toBeHidden();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(page.locator(".resume-preview-panel")).toBeVisible();
  await expect(page.locator(".resume-input-panel")).toBeHidden();
  await page.screenshot({ path: "test-results/editor-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(page.locator(".resume-mobile-tabs")).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".resume-mobile-tabs")).toBeHidden();
  await expect(page.locator(".resume-input-panel")).toBeVisible();
  await expect(page.locator(".resume-preview-panel")).toBeVisible();
  await page.getByRole("button", { name: "← 목록", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const thumbnail = page.locator(".resume-thumbnail");
  const paper = thumbnail.locator(".resume-paper").first();
  await expect(paper).toBeVisible();
  const a = (await thumbnail.boundingBox())!;
  await expect
    .poll(async () => (await paper.boundingBox())!.width)
    .toBeCloseTo(a.width, 0);
  await page.screenshot({ path: "test-results/library-mobile.png" });
  await page.route("**/api/resumes?*", (route) => route.abort("failed"));
  await page.reload();
  await expect(page.locator(".resume-error-state")).toBeVisible();
  await expect(page.getByText("첫 이력서를 만들어 보세요.")).toHaveCount(0);
  await page.unroute("**/api/resumes?*");
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "반응형 검증 문서", exact: true }),
  ).toBeVisible();
  const card = await menu(page, "반응형 검증 문서");
  await card.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제 확인", exact: true })
    .click();
  await expect(page.getByText("첫 이력서를 만들어 보세요.")).toBeVisible();
});
