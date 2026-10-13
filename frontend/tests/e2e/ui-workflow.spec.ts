import { randomUUID, randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";

/** Requires a running application with real backend/PostgreSQL. No API interception. */
test("real session, document CRUD, autosave, responsive preview and protected print", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `ui-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const title = `검증 이력서 ${randomUUID().slice(0, 8)}`;
  const renamed = `${title} 수정`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Only the browser-native print dialog is replaced; iframe GET/render and API writes remain real.
  await page.addInitScript(() => {
    window.addEventListener("message", (event) => {
      if (
        event.origin === location.origin &&
        event.data?.type === "ui-test-print-called"
      ) {
        document.documentElement.dataset.printCalls = "1";
      }
    });
    window.print = () => {
      window.parent.postMessage(
        { type: "ui-test-print-called" },
        location.origin,
      );
      window.dispatchEvent(new Event("afterprint"));
    };
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeEmpty();
  await page.screenshot({ path: "/tmp/resumecraft-login-desktop.png" });
  await page.goto("/resumes");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/signup");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByText("닉네임은 2~12자입니다")).toBeVisible();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("닉네임").fill("UI검증");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(
    page.getByText("아직 이력서가 없습니다. 새 이력서를 만들어 보세요."),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/resumecraft-library-empty.png" });

  await page.getByRole("button", { name: "+ 새 이력서", exact: true }).click();
  const create = page.getByRole("dialog", { name: "새 이력서", exact: true });
  await create.getByLabel("제목").fill(title);
  await create.getByLabel("템플릿").selectOption("modern");
  await create.getByRole("button", { name: "생성", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes\/\d+\/edit$/);
  const editorPath = new URL(page.url()).pathname;
  await page.getByLabel("이름", { exact: true }).fill("검증 사용자");
  await page.getByRole("button", { name: "PDF 내보내기", exact: true }).click();
  const missing = page.getByRole("dialog", { name: "빠진 항목" });
  await expect(missing).toBeVisible();
  await expect(page.locator("iframe.print-frame")).toHaveCount(0);
  await missing
    .getByRole("button", { name: "기본정보 · 희망 직무", exact: true })
    .click();
  await expect(page.getByLabel("희망 직무")).toBeFocused();
  await page.getByLabel("희망 직무").fill("프론트엔드 개발자");
  await expect(page.locator(".a4-page h1")).toHaveText("검증 사용자");
  await expect(
    page.getByRole("button", { name: "저장됨", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "템플릿·스타일", exact: true })
    .click();
  await page.getByLabel("템플릿").selectOption("classic");
  await page.getByLabel("강조색").selectOption("#0F766E");
  await page.getByLabel("글꼴").selectOption("noto-serif-kr");
  await page
    .getByRole("button", { name: "템플릿·스타일", exact: true })
    .click();
  await expect(page.getByLabel("희망 직무")).toHaveValue("프론트엔드 개발자");
  await page.screenshot({ path: "/tmp/resumecraft-editor-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(page.locator(".preview-panel")).toBeVisible();
  await expect(page.locator(".editor-panel")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/resumecraft-editor-mobile.png" });
  await page.getByRole("button", { name: "입력", exact: true }).click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "검증 사용자",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByRole("button", { name: "PDF 내보내기", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-calls", "1");
  await expect(page.locator("iframe.print-frame")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${editorPath}$`));
  await page.getByRole("button", { name: "← 목록", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(
    page.getByRole("link", { name: `${title} 편집`, exact: true }),
  ).toBeVisible();
  const thumbnailScale = await page
    .locator(".thumbnail-document")
    .first()
    .evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).a,
    );
  expect(thumbnailScale).toBeLessThan(0.3);
  expect(thumbnailScale).toBeGreaterThan(0.1);
  await page.getByRole("link", { name: `${title} 편집`, exact: true }).click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "검증 사용자",
  );
  await expect(page.locator(".resume-renderer.classic")).toBeVisible();
  await page.goto(`/print/${editorPath.split("/")[2]}`);
  await expect(
    page.getByText("인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다."),
  ).toBeVisible();
  await page.goto("/resumes");

  await page
    .getByRole("button", { name: `${title} 메뉴`, exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "복제", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: `${title} 메뉴`, exact: true })
    .click();
  await page.getByRole("heading", { name: "내 이력서", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "복제", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: `${title} 메뉴`, exact: true })
    .click();
  await page.getByRole("button", { name: "이름 변경", exact: true }).click();
  await page.getByLabel("이력서 이름").fill(renamed);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `${renamed} 편집`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `${renamed} 메뉴`, exact: true })
    .click();
  await page.getByRole("button", { name: "복제", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `${renamed} (사본) 편집`, exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/resumecraft-library-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: `${renamed} 편집`, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/resumecraft-library-mobile.png" });
  await page
    .getByRole("button", { name: `${renamed} 메뉴`, exact: true })
    .click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "취소", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: `${renamed} 편집`, exact: true }),
  ).toBeVisible();
  for (const name of [renamed, `${renamed} (사본)`]) {
    await page
      .getByRole("button", { name: `${name} 메뉴`, exact: true })
      .click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "삭제 확인", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: `${name} 편집`, exact: true }),
    ).toHaveCount(0);
  }
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(
    page.getByText("아직 이력서가 없습니다. 새 이력서를 만들어 보세요."),
  ).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.goto(editorPath);
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
