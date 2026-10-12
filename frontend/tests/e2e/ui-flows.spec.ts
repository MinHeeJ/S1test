import { expect, test, type Page } from "@playwright/test";

async function signup(page: Page) {
  await page.goto("/signup");
  const email = `ui-${Date.now()}-${test.info().workerIndex}@example.test`;
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("닉네임").fill("UI검증");
  const password = `UiCheck-${crypto.randomUUID()}`;
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(page.locator(".library-empty")).toBeVisible();
}

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "+ 새 이력서", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "새 이력서 생성" });
  await dialog.getByLabel("제목").fill(title);
  await dialog.getByLabel("classic", { exact: true }).check();
  await dialog.getByRole("button", { name: "생성", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes\/\d+\/edit$/);
  await expect(page.getByLabel("이름", { exact: true })).toBeVisible();
}

async function saved(page: Page) {
  await expect(page.locator(".save-status")).toHaveText("저장됨", {
    timeout: 15000,
  });
}

test("real session CRUD, serialized autosave, design, photo and iframe print", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener("beforeprint", () => {
      window.parent.postMessage(
        "ui-verification-print",
        window.location.origin,
      );
    });
    window.addEventListener("message", (event) => {
      if (
        event.origin === window.location.origin &&
        event.data === "ui-verification-print"
      )
        document.documentElement.dataset.printVerified = "true";
    });
  });
  await signup(page);
  await create(page, "UI 실제 저장 검증");
  const editor = page.url();
  const id = editor.match(/resumes\/(\d+)/)![1];
  await page.getByRole("button", { name: "PDF 내보내기", exact: true }).click();
  await page
    .getByRole("dialog", { name: "빠진 항목" })
    .getByRole("button", { name: "기본정보 · 희망 직무", exact: true })
    .click();
  await expect(page.getByLabel("희망 직무", { exact: true })).toBeFocused();
  await page.getByLabel("이름", { exact: true }).fill("브라우저 검증");
  await page.getByLabel("희망 직무", { exact: true }).fill("프론트엔드 개발자");
  await page.getByRole("button", { name: "자기소개 접기" }).click();
  await expect(page.getByLabel("본문", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "자기소개 펼치기" }).click();
  await page
    .getByLabel("본문", { exact: true })
    .fill("실제 API와 PostgreSQL 저장을 검증합니다.");
  await saved(page);
  const response = await page.request.get(`/api/resumes/${id}`);
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()).data;
  expect(data.content[0].data.name).toBe("브라우저 검증");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 30;
    canvas.height = 40;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#0F766E";
    context.fillRect(0, 0, 30, 40);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator(".photo-control input[type=file]").setInputFiles({
    name: "ui-verification.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.getByAltText("등록 사진")).toBeVisible();
  await saved(page);
  const photoId = (await (await page.request.get(`/api/resumes/${id}`)).json())
    .data.content[0].data.photoId;
  expect((await page.request.get(`/api/photos/${photoId}`)).ok()).toBeTruthy();
  await page.locator(".photo-control input[type=file]").setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image"),
  });
  await expect(page.locator(".resume-toast")).toContainText(
    "올바른 JPG 또는 PNG",
  );
  expect(
    (await (await page.request.get(`/api/resumes/${id}`)).json()).data
      .content[0].data.photoId,
  ).toBe(photoId);
  await page
    .getByRole("button", { name: "템플릿·스타일", exact: true })
    .click();
  await page.getByLabel("템플릿", { exact: true }).selectOption("modern");
  await page.getByRole("button", { name: "#0F766E", exact: true }).click();
  await page.getByLabel("글꼴", { exact: true }).selectOption("noto-serif-kr");
  await saved(page);
  await page.reload();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "브라우저 검증",
  );
  await expect(
    page.locator(".editor-preview-panel .resume-renderer"),
  ).toHaveClass(/modern/);
  await page
    .getByRole("button", { name: "UI 실제 저장 검증", exact: true })
    .click();
  await page.getByLabel("이력서 제목", { exact: true }).fill("UI 변경한 제목");
  await page.getByRole("button", { name: "제목 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "UI 변경한 제목", exact: true }),
  ).toBeVisible();
  await saved(page);
  await page.getByRole("button", { name: "PDF 내보내기", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-print-verified",
    "true",
    { timeout: 30000 },
  );
  expect(
    await page
      .locator(".editor-preview-panel")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "/tmp/resumecraft-ui/editor-desktop.png" });
  await page.getByRole("button", { name: "사진 삭제", exact: true }).click();
  await saved(page);
  expect(
    (await (await page.request.get(`/api/resumes/${id}`)).json()).data
      .content[0].data.photoId,
  ).toBeNull();
  expect((await page.request.get(`/api/photos/${photoId}`)).ok()).toBeTruthy();
  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(page.locator(".editor-preview-panel")).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".editor-preview-panel")).toBeVisible();
  await expect(page.locator(".editor-input-panel")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("tab", { name: "입력", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "미리보기", exact: true }).click();
  await expect(page.locator(".editor-preview-panel")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "/tmp/resumecraft-ui/editor-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "← 목록", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes$/);
  await page
    .getByRole("button", { name: "UI 변경한 제목 메뉴", exact: true })
    .click();
  await page.getByRole("button", { name: "복제", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "UI 변경한 제목 (사본)", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.locator(".resume-thumbnail .resume-paper").first(),
  ).toBeVisible();
  await expect(
    page.locator(".resume-thumbnail .resume-paper").first(),
  ).toContainText("브라우저 검증");
  await page.screenshot({ path: "/tmp/resumecraft-ui/library-desktop.png" });
  await page
    .getByRole("button", { name: "UI 변경한 제목 (사본) 메뉴", exact: true })
    .click();
  await page.getByRole("button", { name: "이름 변경", exact: true }).click();
  await page.getByRole("dialog").getByLabel("제목").fill("삭제할 사본");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "삭제할 사본 메뉴", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "삭제할 사본 메뉴", exact: true })
    .click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "취소", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "삭제할 사본 메뉴", exact: true }),
  ).toBeVisible();
  for (const title of ["삭제할 사본", "UI 변경한 제목"]) {
    await page
      .getByRole("button", { name: `${title} 메뉴`, exact: true })
      .click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "확인", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `${title} 메뉴`, exact: true }),
    ).toHaveCount(0);
  }
  await expect(page.locator(".library-empty")).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(editor);
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test("network loading/error recovery and missing document do not fabricate data", async ({
  page,
}) => {
  await signup(page);
  await page.route("**/api/resumes?*", (route) => route.abort("failed"));
  await page.reload();
  await expect(page.locator(".feedback-panel")).toBeVisible();
  await expect(page.locator(".library-empty")).toHaveCount(0);
  await page.unroute("**/api/resumes?*");
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.locator(".library-empty")).toBeVisible();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/resumes?*", async (route) => {
    await pending;
    await route.continue();
  });
  await page.reload();
  await expect(page.locator(".library-loading .skeleton-paper")).toHaveCount(4);
  release();
  await expect(page.locator(".library-empty")).toBeVisible();
  await page.unroute("**/api/resumes?*");
  await page.goto("/resumes/9223372036854775806/edit");
  await expect(
    page.getByText("자료를 찾을 수 없습니다.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("이름", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "목록으로 돌아가기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/resumes$/);
});

test("all public routes and responsive boundaries render without horizontal overflow", async ({
  page,
}) => {
  for (const route of ["/login", "/signup"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [390, 1023, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    }
  }
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: "/tmp/resumecraft-ui/login.png" });
});
