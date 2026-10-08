import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

// Dedicated test accounts and documents are created through the real backend, never injected into the UI.
test("real session, library, editor, persistence, print and destructive actions", async ({
  page,
}, testInfo) => {
  const suffix = randomUUID();
  const email = `ui-${suffix}@example.test`;
  const password = randomUUID();
  const errors: string[] = [];
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printed = "true";
    };
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: testInfo.outputPath("login.png") });
  await page.getByRole("link", { name: "회원가입" }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("닉네임", { exact: true }).fill("UI검증");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(page.getByText("아직 이력서가 없습니다.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("empty-library.png") });
  await page.getByRole("button", { name: "+ 새 이력서" }).click();
  await page.getByRole("dialog").getByLabel("제목").fill("UI 검증 문서");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "생성", exact: true })
    .click();
  await expect(page).toHaveURL(/\/resumes\/[^/]+\/edit$/);
  const editUrl = page.url();
  const id = editUrl.split("/").at(-2)!;
  await page.getByLabel("이름", { exact: true }).fill("검증 사용자");
  await page.getByLabel("희망 직무", { exact: true }).fill("제품 개발");
  await page
    .getByLabel("본문", { exact: true })
    .fill("실제 API 저장과 반응형 화면을 검증합니다.");
  await expect(
    page.getByRole("button", { name: "저장됨", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "자기소개 접기" }).click();
  await expect(page.getByLabel("본문", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "자기소개 펼치기" }).click();
  await expect(page.getByLabel("본문", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "UI 검증 문서", exact: true }).click();
  await page.getByRole("dialog").getByLabel("제목").fill("저장된 검증 문서");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "저장된 검증 문서", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "검증 사용자",
  );
  await expect(page.getByLabel("본문", { exact: true })).toHaveValue(
    "실제 API 저장과 반응형 화면을 검증합니다.",
  );
  await page
    .getByLabel("본문", { exact: true })
    .fill(
      "실제 저장된 긴 본문으로 A4 분할과 배율별 페이지 수의 일치를 검증합니다. ".repeat(
        160,
      ),
    );
  await expect(
    page.getByRole("button", { name: "저장됨", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => page.locator(".resume-preview .resume-paper").count())
    .toBeGreaterThan(1);
  const pageCount = await page.locator(".resume-preview .resume-paper").count();
  for (const width of [1440, 1024, 1023, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 1024)
      await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await expect(page.locator(".resume-preview-panel")).toBeVisible();
    const dimensions = await page
      .locator(".resume-preview-panel")
      .evaluate((element) => ({
        available: element.clientWidth,
        paper: element.querySelector(".resume-paper")!.getBoundingClientRect()
          .width,
      }));
    expect(dimensions.paper).toBeLessThanOrEqual(dimensions.available);
    await expect(page.locator(".resume-preview .resume-paper")).toHaveCount(
      pageCount,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`editor-${width}.png`) });
  }
  await page.getByLabel("배율", { exact: true }).selectOption("150");
  await expect(page.locator(".resume-preview .resume-paper")).toHaveCount(
    pageCount,
  );
  await page.getByLabel("배율", { exact: true }).selectOption("fit");
  await page.getByRole("button", { name: "입력", exact: true }).click();
  // Use a real PNG produced by the browser itself; the server performs actual multipart persistence.
  const photo = await page.screenshot();
  await page.getByLabel("사진 파일 선택").setInputFiles({
    name: "ui-photo.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await expect(
    page.getByRole("button", { name: "사진 변경", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "저장됨", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PDF 내보내기", exact: true }).click();
  await expect(page.locator("iframe[title='이력서 PDF 인쇄']")).toHaveAttribute(
    "src",
    `/print/${id}`,
  );
  await expect(
    page.frameLocator("iframe").locator(".resume-paper").first(),
  ).toBeVisible();
  await expect(page.frameLocator("iframe").locator("html")).toHaveAttribute(
    "data-printed",
    "true",
  );
  await expect(
    page.frameLocator("iframe").locator(".resume-paper"),
  ).toHaveCount(pageCount);
  await page.route("**/api/photos/*", (route) => route.abort());
  await page.getByRole("button", { name: "PDF 내보내기", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "인쇄를 완료하지 못했습니다",
  );
  await expect(page.frameLocator("iframe").locator("html")).not.toHaveAttribute(
    "data-printed",
    "true",
  );
  await page.unroute("**/api/photos/*");
  await page.getByRole("button", { name: "← 목록", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "저장된 검증 문서", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath("library.png") });
  await page.getByRole("button", { name: "저장된 검증 문서 메뉴" }).click();
  await page.getByRole("menuitem", { name: "복제", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "저장된 검증 문서 (사본)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "저장된 검증 문서 메뉴", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "취소" }).click();
  await expect(
    page.getByRole("link", { name: "저장된 검증 문서", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "저장된 검증 문서 메뉴", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제 확인" })
    .click();
  await expect(
    page.getByRole("link", { name: "저장된 검증 문서", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/resumes?*", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "목록을 불러오지 못했습니다.",
  );
  await page.screenshot({ path: testInfo.outputPath("library-error.png") });
  await page.unroute("**/api/resumes?*");
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "저장된 검증 문서 (사본)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(editUrl);
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
