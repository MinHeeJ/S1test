import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ResumeListPage } from "./ResumeListPage";
import { ResumeEditorPage } from "./ResumeEditorPage";
import { ResumePrintPage } from "./ResumePrintPage";
import { ResumeRenderer } from "./ResumeRenderer";
import { ResumeApiError, resumeApi, resumeRequest } from "./resumeApi";
import { logout } from "../auth/authApi";
import { resumeFixture as originalFixture } from "../../../tests/fixtures/resumeSeeds";
function resumeFixture() {
  const resume = originalFixture();
  for (const section of resume.content) {
    if (section.type === "basics") {
      section.data.name = "지우";
      section.data.jobTitle = "개발자";
      section.data.email = "jiwoo@resume.dev";
    } else if ("items" in section) {
      const item = section.items[0] as unknown as Record<string, string>;
      const field = {
        experience: "company",
        education: "school",
        projects: "name",
        certificates: "name",
        languages: "language",
      }[section.type];
      if (item) item[field] = "테스트 항목";
    }
  }
  return resume;
}

vi.mock("../auth/authApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/authApi")>()),
  logout: vi.fn(),
}));
vi.mock("./resumeApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("./resumeApi")>();
  return {
    ...original,
    resumeRequest: vi.fn(),
    resumeApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      duplicate: vi.fn(),
      save: vi.fn(),
    },
  };
});
function mount(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resumes" element={element} />
        <Route
          path="/resumes/:id/edit"
          element={path.includes("/edit") ? element : <p>편집기 목적지</p>}
        />
        <Route path="/print/:id" element={element} />
        <Route path="/login" element={<p>로그인 목적지</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.mocked(resumeRequest).mockResolvedValue({ nickname: "지우" });
  vi.mocked(resumeApi.list).mockResolvedValue([resumeFixture()]);
  vi.mocked(resumeApi.get).mockResolvedValue(resumeFixture());
  vi.mocked(resumeApi.save).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("목록과 작업 모달", () => {
  it("제목 검증 오류는 모달에만 표시하고 기존 카드를 유지한다", async () => {
    mount("/resumes", <ResumeListPage />);
    const link = await screen.findByRole("link", {
      name: `${resumeFixture().title} 편집`,
    });
    fireEvent.click(screen.getByRole("button", { name: "+ 새 이력서" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(link.isConnected).toBe(true);
    expect(resumeApi.create).not.toHaveBeenCalled();
  });
  it("목록 조회 실패를 빈 이력서 목록으로 표시하지 않는다", async () => {
    vi.mocked(resumeApi.list).mockRejectedValueOnce(new Error("연결 오류"));
    mount("/resumes", <ResumeListPage />);
    await screen.findByRole("button", { name: "다시 시도" });
    expect(screen.queryByText("첫 이력서를 만들어 보세요.")).toBeNull();
  });
  it("조회 중에는 문서 skeleton을 표시한다", async () => {
    vi.mocked(resumeApi.list).mockReturnValueOnce(new Promise(() => {}));
    mount("/resumes", <ResumeListPage />);
    expect(await screen.findByTestId("resume-library-loading")).toBeTruthy();
  });

  it("권한 있는 카드 링크가 선택한 id의 편집기로 연결된다", async () => {
    mount("/resumes", <ResumeListPage />);
    const link = await screen.findByRole("link", {
      name: `${resumeFixture().title} 편집`,
    });
    expect(link.getAttribute("href")).toBe(
      `/resumes/${resumeFixture().id}/edit`,
    );
    fireEvent.click(link);
    expect(await screen.findByText("편집기 목적지")).toBeTruthy();
  });
  it("삭제 취소는 호출하지 않고 확인만 삭제한다", async () => {
    mount("/resumes", <ResumeListPage />);
    await screen.findByRole("link", { name: `${resumeFixture().title} 편집` });
    fireEvent.click(screen.getByRole("button", { name: "삭제", hidden: true }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(resumeApi.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제", hidden: true }));
    fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
    await waitFor(() =>
      expect(resumeApi.remove).toHaveBeenCalledWith(resumeFixture().id),
    );
  });
  it("생성 모달은 서버가 반환한 id로 이동한다", async () => {
    vi.mocked(resumeApi.create).mockResolvedValue({ id: "created-from-api" });
    mount("/resumes", <ResumeListPage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이력서" }));
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "지원용" },
    });
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    expect(await screen.findByText("편집기 목적지")).toBeTruthy();
    expect(resumeApi.create).toHaveBeenCalledWith("지원용", "classic");
  });
  it("이름 변경은 빈 제목을 막고 성공 후 목록을 재조회한다", async () => {
    mount("/resumes", <ResumeListPage />);
    await screen.findByRole("link", { name: `${resumeFixture().title} 편집` });
    fireEvent.click(
      screen.getByRole("button", { name: "이름 변경", hidden: true }),
    );
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(resumeApi.rename).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "바뀐 이름" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(resumeApi.rename).toHaveBeenCalledWith(
        resumeFixture().id,
        "바뀐 이름",
      ),
    );
  });
  it("복제는 선택된 id를 전송한다", async () => {
    mount("/resumes", <ResumeListPage />);
    await screen.findByRole("link", { name: `${resumeFixture().title} 편집` });
    fireEvent.click(screen.getByRole("button", { name: "복제", hidden: true }));
    await waitFor(() =>
      expect(resumeApi.duplicate).toHaveBeenCalledWith(resumeFixture().id),
    );
  });
  it("20건 뒤 페이지를 계속 읽어 모든 카드에 도달한다", async () => {
    const first = Array.from({ length: 20 }, (_, i) => ({
      ...resumeFixture(),
      id: `row-${i}`,
      title: `이력서 ${i}`,
    }));
    vi.mocked(resumeApi.list)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([resumeFixture()]);
    mount("/resumes", <ResumeListPage />);
    await screen.findByText("21개 이력서");
    expect(resumeApi.list).toHaveBeenCalledWith(1, 20, undefined);
  });
  it("빈 목록과 요청 실패에 각각 안내·재시도가 있다", async () => {
    vi.mocked(resumeApi.list).mockResolvedValueOnce([]);
    mount("/resumes", <ResumeListPage />);
    expect(await screen.findByText("첫 이력서를 만들어 보세요.")).toBeTruthy();
    cleanup();
    vi.mocked(resumeApi.list).mockRejectedValueOnce(new Error("조회 실패"));
    mount("/resumes", <ResumeListPage />);
    expect(
      await screen.findByRole("button", { name: "다시 시도" }),
    ).toBeTruthy();
  });
  it("401 목록은 로그인 경계로 이동한다", async () => {
    vi.mocked(resumeApi.list).mockRejectedValueOnce(
      new ResumeApiError(401, "Unauthorized"),
    );
    mount("/resumes", <ResumeListPage />);
    expect(await screen.findByText("로그인 목적지")).toBeTruthy();
  });
  it("로그아웃은 기존 인증 API를 호출하고 로그인으로 이동한다", async () => {
    mount("/resumes", <ResumeListPage />);
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(await screen.findByText("로그인 목적지")).toBeTruthy();
    expect(logout).toHaveBeenCalledOnce();
  });
});
describe("편집기 계약", () => {
  it("필수 입력을 표시하되 HTML 검증으로 자동저장을 차단하지 않는다", async () => {
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    const job = await screen.findByLabelText("희망 직무");
    for (const label of ["이름", "희망 직무", "이메일"]) {
      const input = screen.getByLabelText(label);
      expect(input.getAttribute("aria-required")).toBe("true");
      expect(input.closest("label")?.textContent).toContain("필수");
      expect(input.hasAttribute("required")).toBe(false);
    }
    expect(
      screen.getByLabelText("전화번호").getAttribute("aria-required"),
    ).not.toBe("true");
    fireEvent.change(job, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    await waitFor(() => expect(resumeApi.save).toHaveBeenCalled());
  });
  it("접힌 경력 요약에 직책·현재 기간을 표시하고 펼쳐도 항목을 유지한다", async () => {
    const resume = resumeFixture();
    const section = resume.content.find((s) => s.type === "experience")!;
    section.items[0].company = "회사";
    section.items[0].position = "개발자";
    section.items[0].start = "2024.01";
    section.items[0].end = "2025.02";
    section.items[0].current = true;
    vi.mocked(resumeApi.get).mockResolvedValueOnce(resume);
    mount(`/resumes/${resume.id}/edit`, <ResumeEditorPage />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "회사 · 개발자 · 2024.01 ~ 현재",
      }),
    );
    expect((screen.getByLabelText("회사명") as HTMLInputElement).value).toBe(
      "회사",
    );
    expect(screen.getByLabelText("회사명").getAttribute("aria-required")).toBe(
      "true",
    );
    expect((screen.getByLabelText("종료") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(resumeApi.save).not.toHaveBeenCalled();
  });
  it("빈 첫 필드와 어학 시험명도 접힌 요약에서 구별한다", async () => {
    const resume = resumeFixture();
    const section = resume.content.find((s) => s.type === "languages")!;
    section.items[0].language = "";
    section.items[0].test = "TOEIC";
    vi.mocked(resumeApi.get).mockResolvedValueOnce(resume);
    mount(`/resumes/${resume.id}/edit`, <ResumeEditorPage />);
    expect(
      await screen.findByRole("button", { name: "(제목 없음) · TOEIC" }),
    ).toBeTruthy();
  });
  it("제목 PATCH 성공 후 서버 제목을 재조회하고 현재 본문 입력을 보존한다", async () => {
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    await screen.findByLabelText("희망 직무");
    const saved = { ...resumeFixture(), title: "서버 제목" };
    vi.mocked(resumeApi.get).mockResolvedValueOnce(saved);
    fireEvent.click(
      screen.getByRole("button", { name: resumeFixture().title }),
    );
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "요청 제목" },
    });
    fireEvent.change(screen.getByLabelText("희망 직무"), {
      target: { value: "편집 중인 본문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(
      await screen.findByRole("button", { name: "서버 제목" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "이름 변경" })).toBeNull();
    expect((screen.getByLabelText("희망 직무") as HTMLInputElement).value).toBe(
      "편집 중인 본문",
    );
    expect(resumeApi.rename).toHaveBeenCalledWith(
      resumeFixture().id,
      "요청 제목",
    );
  });
  it("제목의 서버 필드 오류는 입력 옆에 남기고 모달·기존 제목을 보존한다", async () => {
    vi.mocked(resumeApi.rename).mockRejectedValueOnce(
      new ResumeApiError(400, "제목 오류", "title"),
    );
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: resumeFixture().title }),
    );
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "입력 제목" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(screen.getByLabelText("제목").getAttribute("aria-invalid")).toBe(
        "true",
      ),
    );
    const input = screen.getByLabelText("제목");
    expect(
      document.getElementById(input.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("제목 오류");
    expect((input as HTMLInputElement).value).toBe("입력 제목");
    expect(
      screen.getByRole("button", { name: resumeFixture().title }),
    ).toBeTruthy();
  });
  it("섹션 접기는 입력만 접고 미리보기와 저장본을 유지한다", async () => {
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    await screen.findByLabelText("한 줄 소개");
    fireEvent.click(screen.getByRole("button", { name: "자기소개 접기" }));
    expect(screen.queryByLabelText("한 줄 소개")).toBeNull();
    expect(document.querySelector('[data-section="summary"]')).toBeTruthy();
    expect(resumeApi.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "자기소개 펼치기" }));
    expect(screen.getByLabelText("한 줄 소개")).toBeTruthy();
  });
  it("PDF 누락 항목 선택은 접힌 항목을 열고 회사명에 포커스한다", async () => {
    const resume = resumeFixture();
    const section = resume.content.find((s) => s.type === "experience")!;
    section.hidden = false;
    section.items[0].company = "";
    vi.mocked(resumeApi.get).mockResolvedValueOnce(resume);
    mount(`/resumes/${resume.id}/edit`, <ResumeEditorPage />);
    await screen.findByLabelText("희망 직무");
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    const missing = screen.getByRole("dialog", { name: "빠진 항목" });
    fireEvent.click(missing.querySelector("button")!);
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("content.2.items.0.company"),
    );
  });
  it("설정은 입력 영역을 교체하고 닫으면 같은 필드로 돌아온다", async () => {
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    await screen.findByLabelText("희망 직무");
    fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
    const panel = document.querySelector(".resume-input-panel");
    expect(panel?.querySelector(".resume-style")).toBeTruthy();
    expect(screen.queryByLabelText("희망 직무")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
    expect(screen.getByLabelText("희망 직무")).toBeTruthy();
  });
  it("편집기 조회 실패 후 재시도하면 서버 본문으로 복원된다", async () => {
    vi.mocked(resumeApi.get).mockRejectedValueOnce(new Error("조회 실패"));
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    expect(await screen.findByLabelText("희망 직무")).toBeTruthy();
  });

  it("서버 본문으로 입력하며 스타일 변경은 content를 보존한다", async () => {
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    const input = await screen.findByLabelText("희망 직무");
    const basics = resumeFixture().content.find(
      (section) => section.type === "basics",
    )!;
    expect((input as HTMLInputElement).value).toBe(basics.data.jobTitle);
    fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
    fireEvent.change(screen.getByLabelText("템플릿"), {
      target: { value: "modern" },
    });
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    await waitFor(() => expect(resumeApi.save).toHaveBeenCalled());
    expect(vi.mocked(resumeApi.save).mock.calls[0][1].content).toEqual(
      resumeFixture().content,
    );
  });
  it("섹션 숨김을 유지하고 삭제 취소·확인은 다른 결과를 만든다", async () => {
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    await screen.findByLabelText("희망 직무");
    fireEvent.click(screen.getAllByRole("button", { name: "숨김" })[0]);
    expect(screen.getAllByRole("button", { name: "다시 표시" }).length).toBe(2);
    fireEvent.click(screen.getAllByRole("button", { name: "섹션 삭제" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByLabelText("한 줄 소개")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "섹션 삭제" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
    expect(screen.queryByLabelText("한 줄 소개")).toBeNull();
  });
  it("누락 모달은 PDF를 막고 선택 입력에 포커스를 돌려준다", async () => {
    const resume = resumeFixture();
    if (resume.content[0].type === "basics")
      resume.content[0].data.jobTitle = "";
    vi.mocked(resumeApi.get).mockResolvedValueOnce(resume);
    mount(`/resumes/${resume.id}/edit`, <ResumeEditorPage />);
    await screen.findByLabelText("희망 직무");
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    expect(screen.getByRole("dialog", { name: "빠진 항목" })).toBeTruthy();
    expect(document.querySelector(".resume-print-frame")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "기본정보 · 희망 직무" }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("희망 직무")),
    );
  });
  it("저장 실패에서는 목록 이동과 인쇄를 차단한다", async () => {
    vi.mocked(resumeApi.save).mockRejectedValue(new Error("저장 실패"));
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    fireEvent.change(await screen.findByLabelText("희망 직무"), {
      target: { value: "최신" },
    });
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    expect(await screen.findByText("저장 실패·다시 시도")).toBeTruthy();
    expect(screen.getByLabelText("희망 직무")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    await waitFor(() => expect(resumeApi.save).toHaveBeenCalledTimes(2));
    expect(document.querySelector(".resume-print-frame")).toBeNull();
  });
  it("미저장 상태에서 beforeunload를 막고 입력·미리보기 탭을 제공한다", async () => {
    mount(`/resumes/${resumeFixture().id}/edit`, <ResumeEditorPage />);
    fireEvent.change(await screen.findByLabelText("희망 직무"), {
      target: { value: "수정" },
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "미리보기" }));
    expect(
      document.querySelector(".resume-split")?.getAttribute("data-tab"),
    ).toBe("미리보기");
  });
  it("없는 이력서는 폼을 보여 주지 않는다", async () => {
    vi.mocked(resumeApi.get).mockRejectedValueOnce(
      new ResumeApiError(404, "Not Found"),
    );
    mount("/resumes/not-found/edit", <ResumeEditorPage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByLabelText("희망 직무")).toBeNull();
  });
});
describe("공통 renderer와 서버 인쇄", () => {
  it("숨긴 섹션은 출력에서 제외하며 A4 페이지를 제공한다", () => {
    const resume = resumeFixture();
    const summary = resume.content.find((s) => s.type === "summary")!;
    summary.hidden = true;
    summary.data.body = "숨긴 본문";
    render(<ResumeRenderer resume={resume} />);
    expect(screen.queryByText("숨긴 본문")).toBeNull();
    expect(screen.getAllByLabelText(/이력서 \d+페이지/).length).toBeGreaterThan(
      0,
    );
  });
  it("인쇄 화면은 저장본을 조회하고 에디터 크롬 없이 인쇄한다", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    mount(`/print/${resumeFixture().id}`, <ResumePrintPage />);
    await waitFor(() => expect(print).toHaveBeenCalled());
    expect(resumeApi.get).toHaveBeenCalledWith(resumeFixture().id);
    expect(document.title).toBe("지우_개발자_이력서");
    expect(screen.queryByRole("button", { name: "PDF 내보내기" })).toBeNull();
    print.mockRestore();
  });
});
