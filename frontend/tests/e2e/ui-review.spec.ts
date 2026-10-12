import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Every document is created through the real UI/API. No response fixtures or stored credentials.
test("real API-backed account, document CRUD, flush, settings, mobile and print", async ({
  page,
}) => {
  const email = `ui-${randomUUID()}@example.org`;
  const password = randomBytes(24).toString("base64url");
  const title = `UI 검증 ${randomUUID().slice(0, 8)}`;
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printCalled = "true";
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/resumes");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: "test-results/ui-login.png" });
  await page.getByRole("link", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("닉네임", { exact: true }).fill("UI검증");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(
    page.getByText("아직 이력서가 없습니다.", { exact: false }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/ui-empty.png" });
  await page.getByRole("button", { name: "＋ 새 이력서" }).click();
  const create = page.getByRole("dialog", { name: "새 이력서" });
  await create.getByLabel("제목").fill(title);
  await create.getByLabel("템플릿").selectOption("classic");
  await expect(create.getByLabel("템플릿")).toHaveValue("classic");
  await create.getByRole("button", { name: "생성", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes\/[^/]+\/edit$/);
  const id = page.url().split("/").at(-2)!;
  await expect(page.getByLabel("이름", { exact: true })).toBeVisible();
  await page.getByLabel("이름", { exact: true }).fill("저장 검증");
  await page.getByLabel("희망 직무", { exact: true }).fill("프론트엔드 개발자");
  await page.getByRole("link", { name: "ResumeCraft", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await page.getByRole("link", { name: `${title} 편집`, exact: true }).click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "저장 검증",
  );
  await page
    .getByRole("button", { name: "템플릿·스타일", exact: true })
    .click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveCount(0);
  await page.getByLabel("템플릿").selectOption("modern");
  await page.getByLabel("강조색").selectOption("#0F766E");
  await page
    .getByRole("button", { name: "템플릿·스타일", exact: true })
    .click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "저장 검증",
  );
  await page.screenshot({ path: "test-results/ui-editor.png" });
  await page.getByRole("button", { name: "PDF 내보내기", exact: true }).click();
  const print = page.frameLocator(".print-frame");
  await expect(print.locator(".resume-print")).toContainText("저장 검증");
  await expect(print.locator("html")).toHaveAttribute(
    "data-print-called",
    "true",
  );
  await expect(page).toHaveURL(/\/edit$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "미리보기", exact: true }).click();
  await expect(page.locator(".editor-preview")).toBeVisible();
  await expect(page.locator(".editor-input")).toBeHidden();
  await page.screenshot({ path: "test-results/ui-mobile-preview.png" });
  await page.getByRole("tab", { name: "입력", exact: true }).click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "저장 검증",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "← 목록", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  const stored = await page.request.get(`/api/resumes/${id}`);
  expect(stored.ok()).toBeTruthy();
  const record = (await stored.json()).data;
  expect(record.template).toBe("modern");
  expect(record.content[0].data.name).toBe("저장 검증");
  await page
    .getByRole("button", { name: `${title} 작업`, exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "복제", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: `${title} 작업`, exact: true })
    .click();
  await page.getByRole("button", { name: "복제", exact: true }).click();
  const copy = `${title} (사본)`;
  await expect(
    page.getByRole("link", { name: `${copy} 편집`, exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/ui-resumes.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      return page
        .locator(".resume-thumbnail")
        .first()
        .evaluate((node) => {
          const document = node.querySelector(".resume-document")!;
          return Math.abs(
            document.getBoundingClientRect().width -
              node.getBoundingClientRect().width,
          );
        });
    })
    .toBeLessThan(1);
  await page.screenshot({ path: "test-results/ui-mobile-resumes.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: `${copy} 작업`, exact: true }).click();
  await page.getByRole("button", { name: "이름 변경", exact: true }).click();
  await page.getByLabel("이력서 이름", { exact: true }).fill(`${title} 정리`);
  await page.getByRole("button", { name: "이름 저장", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `${title} 정리 편집`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `${title} 정리 작업`, exact: true })
    .click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "이력서 삭제" })
    .getByRole("button", { name: "취소" })
    .click();
  await expect(
    page.getByRole("link", { name: `${title} 정리 편집`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `${title} 정리 작업`, exact: true })
    .click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `${title} 정리 편집`, exact: true }),
  ).toHaveCount(0);
  await page.goto(`/print/${id}`);
  await expect(
    page.locator(".resume-print .resume-paper").first(),
  ).toBeVisible();
  await expect(page.locator(".resume-print")).toContainText("저장 검증");
  await page.screenshot({ path: "test-results/ui-print.png" });
  await page.goto("/resumes");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(
    page.getByRole("link", { name: `${title} 편집`, exact: true }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});
