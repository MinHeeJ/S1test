import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Resume } from "../../domain/resume/types";
import { resumeSeeds } from "../../../tests/fixtures/resumeSeeds";
import { apiClient, ApiError } from "../../api/apiClient";
import { resumesApi } from "./resumesApi";
import { ResumeListPage } from "./ResumeListPage";
import { ResumeEditorLoader, ResumeEditor } from "./ResumeEditorLoader";
import { ResumeRenderer, safeLink } from "./ResumeRenderer";
import { PrintPage } from "./PrintPage";
import { SectionFields } from "./SectionFields";

vi.mock("./resumesApi", () => ({
  resumesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
  },
}));
vi.mock("../../api/apiClient", async (original) => ({
  ...(await original<typeof import("../../api/apiClient")>()),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
const fixture = () =>
  ({
    ...structuredClone(resumeSeeds[1]),
    id: crypto.randomUUID(),
    updated_at: "2025-01-01T00:00:00Z",
  }) as unknown as Resume;
const response = <T,>(data: T) => ({ success: true as const, meta: {}, data });
function routes(initial: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/resumes"
          element={initial === "/resumes" ? element : <h1>이동된 목록</h1>}
        />
        <Route
          path="/resumes/:id/edit"
          element={initial === "/resumes" ? <ResumeEditorLoader /> : element}
        />
        <Route path="/print/:id" element={element} />
        <Route path="/login" element={<h1>로그인</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue(response({ nickname: "지우" }));
  vi.mocked(apiClient.post).mockResolvedValue(response(undefined));
  vi.mocked(resumesApi.list).mockResolvedValue({
    ...response([]),
    meta: { total: 0 },
  });
  vi.mocked(resumesApi.update).mockResolvedValue(response(undefined));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
});

describe("목록 및 supporting create/rename/delete/session 화면", () => {
  it("StrictMode의 effect 재실행 후에도 자동저장을 실행한다", async () => {
    const row = fixture();
    routes(
      `/resumes/${row.id}/edit`,
      <StrictMode>
        <ResumeEditor initial={row} />
      </StrictMode>,
    );
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "저장 확인" },
    });
    await waitFor(() => expect(resumesApi.update).toHaveBeenCalledOnce(), {
      timeout: 3000,
    });
    expect(screen.getByRole("button", { name: "저장됨" })).toBeVisible();
  });
  it("누락된 접힌 항목의 필드를 열고 포커스한다", async () => {
    const row = fixture();
    row.content = row.content.filter(
      (section) => section.type !== "experience",
    );
    row.content.push({
      type: "experience",
      hidden: false,
      items: [
        {
          id: "focus-item",
          company: "",
          position: "",
          start: "",
          end: "",
          current: false,
          description: "",
        },
      ],
    });
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "필수값 누락" })).getByRole(
        "button",
        { name: /회사명/ },
      ),
    );
    await screen.findByLabelText("회사명");
    await waitFor(() => expect(screen.getByLabelText("회사명")).toBeVisible());
    await waitFor(() => expect(screen.getByLabelText("회사명")).toHaveFocus());
  });
  it("기본정보 사진은 공통 PhotoPicker로 업로드하고 성공 id를 연결한다", async () => {
    const row = fixture();
    const basics = row.content.find((section) => section.type === "basics")!;
    const change = vi.fn();
    vi.mocked(apiClient.post).mockResolvedValue(
      response({ photoId: "uploaded-photo" }),
    );
    render(
      <SectionFields
        section={basics}
        index={0}
        change={change}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "사진 등록" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("사진 파일"), {
      target: {
        files: [new File(["image-bytes"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        ...basics,
        data: { ...basics.data, photoId: "uploaded-photo" },
      }),
    );
  });
  it("조회 중에는 디자인된 skeleton을 보여준다", () => {
    vi.mocked(resumesApi.list).mockReturnValue(new Promise(() => undefined));
    routes("/resumes", <ResumeListPage />);
    expect(screen.getByTestId("library-skeleton")).toBeVisible();
  });
  it("생성 오류는 모달 안의 제목 입력에 연결하고 목록 오류로 표시하지 않는다", async () => {
    vi.mocked(resumesApi.create).mockRejectedValue(
      new ApiError(400, {
        success: false,
        meta: {},
        code: "BAD_REQUEST",
        message: "제목을 확인해주세요.",
        field: "title",
      }),
    );
    routes("/resumes", <ResumeListPage />);
    await screen.findByText("이력서가 없습니다. 새 이력서를 만들어보세요.");
    fireEvent.click(screen.getByText("+ 새 이력서"));
    const dialog = screen.getByRole("dialog", { name: "새 이력서" });
    fireEvent.click(within(dialog).getByRole("button", { name: "생성" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "제목을 확인해주세요.",
    );
    expect(within(dialog).getByLabelText("제목")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
  it("편집 조회 실패 후 실제 GET을 다시 실행하여 입력을 복구한다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.get).mockRejectedValueOnce(new Error("조회 실패"));
    routes(`/resumes/${row.id}/edit`, <ResumeEditorLoader />);
    await screen.findByText("조회 실패");
    vi.mocked(resumesApi.get).mockResolvedValue(response(row));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByLabelText("희망 직무")).toHaveValue(
      "백엔드 개발자",
    );
  });
  it("빈 목록, 실제 nickname, 생성 모달에서 서버 id의 편집 route로 진입한다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.create).mockResolvedValue(response({ id: row.id }));
    vi.mocked(resumesApi.get).mockResolvedValue(response(row));
    routes("/resumes", <ResumeListPage />);
    expect(
      await screen.findByText("이력서가 없습니다. 새 이력서를 만들어보세요."),
    ).toBeVisible();
    expect(screen.getByText("지우")).toBeVisible();
    fireEvent.click(screen.getByText("+ 새 이력서"));
    const dialog = screen.getByRole("dialog", { name: "새 이력서" });
    fireEvent.change(within(dialog).getByLabelText("제목"), {
      target: { value: "  지원서  " },
    });
    fireEvent.change(within(dialog).getByLabelText("템플릿"), {
      target: { value: "modern" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "생성" }));
    await waitFor(() =>
      expect(resumesApi.create).toHaveBeenCalledWith("  지원서  ", "modern"),
    );
    expect(
      await screen.findByRole("button", { name: row.title }),
    ).toBeVisible();
    expect(resumesApi.get).toHaveBeenCalledWith(row.id);
  });
  it("카드 링크로 선택한 id에 도달해 서버 폼을 표시한다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.list).mockResolvedValue({
      ...response([row]),
      meta: { total: 1 },
    });
    vi.mocked(resumesApi.get).mockResolvedValue(response(row));
    routes("/resumes", <ResumeListPage />);
    fireEvent.click(await screen.findByRole("link", { name: row.title }));
    expect(await screen.findByLabelText("희망 직무")).toHaveValue(
      "백엔드 개발자",
    );
    expect(resumesApi.get).toHaveBeenCalledWith(row.id);
  });
  it("삭제 취소는 요청 없이 카드 유지, 확인만 삭제하고 재조회한다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.list).mockResolvedValue({
      ...response([row]),
      meta: { total: 1 },
    });
    vi.mocked(resumesApi.delete).mockResolvedValue(response(undefined));
    routes("/resumes", <ResumeListPage />);
    await screen.findByRole("link", { name: row.title });
    fireEvent.click(
      within(
        screen.getByRole("link", { name: row.title }).closest("article")!,
      ).getByRole("button", { name: "삭제", hidden: true }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(resumesApi.delete).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: row.title })).toBeVisible();
    fireEvent.click(
      within(
        screen.getByRole("link", { name: row.title }).closest("article")!,
      ).getByRole("button", { name: "삭제", hidden: true }),
    );
    vi.mocked(resumesApi.list).mockResolvedValue({
      ...response([]),
      meta: { total: 0 },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }),
    );
    await waitFor(() => expect(resumesApi.delete).toHaveBeenCalledWith(row.id));
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: row.title }),
      ).not.toBeInTheDocument(),
    );
  });
  it("이름 변경은 PATCH 후 목록 재조회이며 빈값 제출은 불가하다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.list).mockResolvedValue({
      ...response([row]),
      meta: { total: 1 },
    });
    vi.mocked(resumesApi.rename).mockResolvedValue(response(undefined));
    routes("/resumes", <ResumeListPage />);
    await screen.findByRole("link", { name: row.title });
    fireEvent.click(
      screen.getByRole("button", { name: "이름 변경", hidden: true }),
    );
    const dialog = screen.getByRole("dialog", { name: "이름 변경" });
    fireEvent.change(within(dialog).getByLabelText("제목"), {
      target: { value: " " },
    });
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("제목"), {
      target: { value: "변경" },
    });
    vi.mocked(resumesApi.list).mockResolvedValue({
      ...response([{ ...row, title: "변경" }]),
      meta: { total: 1 },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("link", { name: "변경" })).toBeVisible();
    expect(resumesApi.rename).toHaveBeenCalledWith(row.id, "변경");
  });
  it("복제는 원본 id 사용 후 목록에 별도 사본을 표시한다", async () => {
    const row = fixture();
    const copy = {
      ...row,
      id: crypto.randomUUID(),
      title: `${row.title} (사본)`,
    };
    vi.mocked(resumesApi.list)
      .mockResolvedValueOnce({ ...response([row]), meta: { total: 1 } })
      .mockResolvedValue({ ...response([copy, row]), meta: { total: 2 } });
    vi.mocked(resumesApi.duplicate).mockResolvedValue(
      response({ id: copy.id }),
    );
    routes("/resumes", <ResumeListPage />);
    await screen.findByRole("link", { name: row.title });
    fireEvent.click(screen.getByRole("button", { name: "복제", hidden: true }));
    expect(await screen.findByRole("link", { name: copy.title })).toBeVisible();
    expect(resumesApi.duplicate).toHaveBeenCalledWith(row.id);
  });
  it("목록 실패는 오류와 재시도, 무세션은 로그인으로 이동한다", async () => {
    vi.mocked(resumesApi.list).mockRejectedValueOnce(new Error("목록 실패"));
    routes("/resumes", <ResumeListPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("목록 실패");
    vi.mocked(resumesApi.list).mockRejectedValue(
      new ApiError(401, {
        success: false,
        meta: {},
        code: "UNAUTHORIZED",
        message: "로그인 필요",
        field: null,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
  });
  it("페이지 이동은 total을 따르며 검색은 첫 페이지부터 literal 값을 전송한다", async () => {
    vi.mocked(resumesApi.list).mockResolvedValue({
      ...response(Array.from({ length: 20 }, fixture)),
      meta: { total: 21 },
    });
    routes("/resumes", <ResumeListPage />);
    await screen.findByText("1 / 2");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() =>
      expect(resumesApi.list).toHaveBeenLastCalledWith(1, 20, ""),
    );
    fireEvent.change(screen.getByLabelText("제목 검색"), {
      target: { value: "%_" },
    });
    await waitFor(() =>
      expect(resumesApi.list).toHaveBeenLastCalledWith(0, 20, "%_"),
    );
  });
  it("로그아웃 성공 후 로그인으로 이동한다", async () => {
    routes("/resumes", <ResumeListPage />);
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    expect(apiClient.post).toHaveBeenCalledWith("/api/auth/logout");
  });
});

describe("UI Contract drift 회귀", () => {
  it("제목 PATCH 뒤 GET의 제목만 반영하고 미저장 본문과 선택을 유지한다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.rename).mockResolvedValue(response(undefined));
    vi.mocked(resumesApi.get).mockResolvedValue(
      response({ ...row, title: "서버가 저장한 제목" }),
    );
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "미저장 본문" },
    });
    const projectDetails = screen
      .getAllByText("프로젝트")
      .find((element) => element.tagName === "SUMMARY")!
      .parentElement as HTMLDetailsElement;
    projectDetails.open = true;
    fireEvent.click(screen.getByRole("button", { name: /이력서 편집 서비스/ }));
    fireEvent.click(screen.getByRole("button", { name: row.title }));
    fireEvent.change(screen.getByLabelText("이력서 제목"), {
      target: { value: "입력한 제목" },
    });
    fireEvent.click(screen.getByRole("button", { name: "제목 저장" }));
    expect(
      await screen.findByRole("button", { name: "서버가 저장한 제목" }),
    ).toBeVisible();
    expect(resumesApi.get).toHaveBeenCalledWith(row.id);
    expect(resumesApi.rename).toHaveBeenCalledWith(row.id, "입력한 제목");
    expect(screen.getByLabelText("이름")).toHaveValue("미저장 본문");
    expect(projectDetails.open).toBe(true);
    expect(screen.getByLabelText("프로젝트명")).toHaveValue(
      "이력서 편집 서비스",
    );
    expect(screen.getByRole("button", { name: "변경됨" })).toBeInTheDocument();
  });

  it("제목 저장의 field 오류는 입력에 연결하고 기존 제목을 유지한다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.rename).mockRejectedValue(
      new ApiError(400, {
        success: false,
        meta: {},
        code: "BAD_REQUEST",
        message: "제목 길이를 확인해주세요.",
        field: "title",
      }),
    );
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.click(screen.getByRole("button", { name: row.title }));
    fireEvent.click(screen.getByRole("button", { name: "제목 저장" }));
    await waitFor(() =>
      expect(screen.getByLabelText("이력서 제목")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(screen.getByLabelText("이력서 제목")).toHaveAccessibleDescription(
      "제목 길이를 확인해주세요.",
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("button", { name: row.title })).toBeVisible();
    expect(resumesApi.get).not.toHaveBeenCalled();
  });

  it("제목 PATCH 성공 뒤 조회 실패는 저장 실패와 구분하고 PATCH를 반복하지 않는다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.rename).mockResolvedValue(response(undefined));
    vi.mocked(resumesApi.get).mockRejectedValue(new Error("조회 연결 실패"));
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.click(screen.getByRole("button", { name: row.title }));
    fireEvent.change(screen.getByLabelText("이력서 제목"), {
      target: { value: "새 제목" },
    });
    fireEvent.click(screen.getByRole("button", { name: "제목 저장" }));
    expect(
      await screen.findByText(/제목은 변경되었지만.*조회 연결 실패/),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: row.title })).toBeVisible();
    expect(resumesApi.rename).toHaveBeenCalledOnce();
    expect(resumesApi.update).not.toHaveBeenCalled();
  });

  it("복제 성공 후 재조회 실패는 결과 확인 실패로 표시하고 자동 재복제하지 않는다", async () => {
    const row = fixture();
    vi.mocked(resumesApi.list)
      .mockResolvedValueOnce({ ...response([row]), meta: { total: 1 } })
      .mockRejectedValue(new Error("목록 연결 실패"));
    vi.mocked(resumesApi.duplicate).mockResolvedValue(
      response({ id: "copy-id" }),
    );
    routes("/resumes", <ResumeListPage />);
    await screen.findByRole("link", { name: row.title });
    fireEvent.click(screen.getByRole("button", { name: "복제", hidden: true }));
    expect(
      await screen.findByText(/복제.*완료되었지만.*목록 연결 실패/),
    ).toBeVisible();
    expect(screen.queryByText("사본을 만들었습니다.")).not.toBeInTheDocument();
    expect(resumesApi.duplicate).toHaveBeenCalledOnce();
    vi.mocked(resumesApi.list).mockResolvedValue({
      ...response([row]),
      meta: { total: 1 },
    });
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("link", { name: row.title });
    expect(resumesApi.duplicate).toHaveBeenCalledOnce();
  });

  it("생성의 template field 오류를 템플릿 선택에 연결한다", async () => {
    vi.mocked(resumesApi.create).mockRejectedValue(
      new ApiError(400, {
        success: false,
        meta: {},
        code: "BAD_REQUEST",
        message: "템플릿을 확인해주세요.",
        field: "template",
      }),
    );
    routes("/resumes", <ResumeListPage />);
    await screen.findByText("이력서가 없습니다. 새 이력서를 만들어보세요.");
    fireEvent.click(screen.getByText("+ 새 이력서"));
    const dialog = screen.getByRole("dialog", { name: "새 이력서" });
    fireEvent.click(within(dialog).getByRole("button", { name: "생성" }));
    await within(dialog).findByRole("alert");
    expect(within(dialog).getByLabelText("템플릿")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(within(dialog).getByLabelText("템플릿")).toHaveAccessibleDescription(
      "템플릿을 확인해주세요.",
    );
    expect(within(dialog).getByLabelText("제목")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });
});

describe("편집/스타일/미저장 종료/인쇄 여정", () => {
  it("404 조회는 본문 없이 오류, loading 중에는 저장하지 않는다", async () => {
    vi.mocked(resumesApi.get).mockRejectedValue(
      new ApiError(404, {
        success: false,
        meta: {},
        code: "NOT_FOUND",
        message: "찾을 수 없습니다.",
        field: null,
      }),
    );
    routes(`/resumes/${crypto.randomUUID()}/edit`, <ResumeEditorLoader />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "찾을 수 없습니다.",
    );
    expect(screen.queryByLabelText("이메일")).not.toBeInTheDocument();
    expect(resumesApi.update).not.toHaveBeenCalled();
  });
  it("미저장 목록 이동은 즉시 PUT 성공을 기다리며 beforeunload를 보호한다", async () => {
    const row = fixture();
    let complete!: () => void;
    vi.mocked(resumesApi.update).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve(response(undefined));
        }),
    );
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "마지막" },
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    expect(
      screen.queryByRole("heading", { name: "이동된 목록" }),
    ).not.toBeInTheDocument();
    expect(resumesApi.update).toHaveBeenCalledWith(
      row.id,
      expect.not.objectContaining({ title: expect.anything() }),
    );
    await act(async () => complete());
    expect(
      await screen.findByRole("heading", { name: "이동된 목록" }),
    ).toBeVisible();
  });
  it("저장 실패는 편집기에 머물고 다시 시도 후 저장됨", async () => {
    const row = fixture();
    vi.mocked(resumesApi.update)
      .mockRejectedValueOnce(new Error("저장 실패"))
      .mockResolvedValue(response(undefined));
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "abc@" },
    });
    expect(screen.getByText("이메일 형식을 확인해주세요.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    expect(
      await screen.findByRole("button", { name: "저장 실패·다시 시도" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("이메일")).toHaveValue("abc@");
    fireEvent.click(
      screen.getByRole("button", { name: "저장 실패·다시 시도" }),
    );
    expect(
      await screen.findByRole("button", { name: "저장됨" }),
    ).toBeDisabled();
  });
  it("PDF 누락은 모달만, 충족 미저장은 PUT 완료 후 iframe을 생성한다", async () => {
    const row = fixture();
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.change(screen.getByLabelText("희망 직무"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    expect(screen.getByRole("dialog", { name: "필수값 누락" })).toBeVisible();
    expect(screen.queryByTitle("PDF 인쇄")).not.toBeInTheDocument();
    expect(resumesApi.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.change(screen.getByLabelText("희망 직무"), {
      target: { value: "개발자" },
    });
    let complete!: () => void;
    vi.mocked(resumesApi.update).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve(response(undefined));
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    expect(screen.queryByTitle("PDF 인쇄")).not.toBeInTheDocument();
    await act(async () => complete());
    expect(await screen.findByTitle("PDF 인쇄")).toHaveAttribute(
      "src",
      expect.stringContaining(`/print/${row.id}`),
    );
  });
  it("PDF 저장 실패는 iframe/인쇄 없음", async () => {
    const row = fixture();
    vi.mocked(resumesApi.update).mockRejectedValue(new Error("저장 실패"));
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    await screen.findByRole("button", { name: "저장 실패·다시 시도" });
    expect(screen.queryByTitle("PDF 인쇄")).not.toBeInTheDocument();
  });
  it("스타일 선택은 본문 보존, 6색 및 9/10/11pt 옵션이고 즉시 미리보기 변경", () => {
    const row = fixture();
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
    fireEvent.change(screen.getByLabelText("템플릿"), {
      target: { value: "modern" },
    });
    fireEvent.click(screen.getByRole("button", { name: "#2563EB" }));
    fireEvent.change(screen.getByLabelText("크기"), {
      target: { value: "large" },
    });
    expect(
      document.querySelector(".editor-preview .resume-renderer"),
    ).toHaveStyle("font-size: 11pt");
    expect(document.querySelector(".editor-preview .resume-paper")).toHaveClass(
      "modern",
    );
    expect(screen.getByRole("button", { name: "#2563EB" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("섹션 숨김 데이터 보존/삭제 취소/확인/없는 종류 재추가", async () => {
    const row = fixture();
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    const summary = screen
      .getAllByText("자기소개")
      .find((element) => element.tagName === "SUMMARY")!;
    const section = summary.closest("section")!;
    fireEvent.click(
      within(section).getByRole("button", { name: "숨기기", hidden: true }),
    );
    expect(section).toHaveClass("section-hidden");
    expect(within(section).getByLabelText("본문")).toHaveValue(
      row.content.find((section) => section.type === "summary")!.data.body,
    );
    fireEvent.click(
      within(section).getByRole("button", { name: "섹션 삭제", hidden: true }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
    );
    expect(section).toBeInTheDocument();
    fireEvent.click(
      within(section).getByRole("button", { name: "섹션 삭제", hidden: true }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }),
    );
    expect(section).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("+ 섹션 추가"), {
      target: { value: "summary" },
    });
    expect(screen.getByLabelText("본문")).toHaveValue("");
  });
  it("세션 종료는 미저장 flush 성공 후 logout만 실행한다", async () => {
    const row = fixture();
    routes(`/resumes/${row.id}/edit`, <ResumeEditor initial={row} />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "새 이름" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    expect(resumesApi.update).toHaveBeenCalledOnce();
    expect(apiClient.post).toHaveBeenCalledWith("/api/auth/logout");
  });
  it("print route의 top-level 진입은 iframe 전용 안내이며 인쇄하지 않는다", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    routes(`/print/${crypto.randomUUID()}`, <PrintPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF 내보내기");
    expect(resumesApi.get).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });
});

describe("동일 A4 renderer와 항목 규칙", () => {
  it("hidden 출력 제외 및 URL은 text로 안전 처리한다", async () => {
    const row = fixture();
    const summary = row.content.find((s) => s.type === "summary")!;
    summary.hidden = true;
    render(<ResumeRenderer resume={row} />);
    await waitFor(() =>
      expect(screen.getByLabelText("A4 1페이지")).toBeInTheDocument(),
    );
    expect(
      within(screen.getByLabelText("A4 1페이지")).queryByText("자기소개"),
    ).not.toBeInTheDocument();
    expect(safeLink("javascript:alert(1)")).toBeUndefined();
    expect(safeLink("https://example.com")).toBe("https://example.com");
  });
  it("current 토글은 end를 보존하며 항목 복제 새 UUID/즉시 삭제/최대20을 준수한다", () => {
    const section = {
      type: "experience" as const,
      hidden: false,
      items: [
        {
          id: crypto.randomUUID(),
          company: "회사",
          position: "",
          start: "2020.01",
          end: "2024.01",
          current: false,
          description: "",
        },
      ],
    };
    const change = vi.fn();
    const view = render(
      <SectionFields
        section={section}
        index={1}
        change={change}
        onError={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /회사/ }));
    fireEvent.click(screen.getByLabelText("재직중"));
    expect(change.mock.lastCall![0].items[0]).toMatchObject({
      current: true,
      end: "2024.01",
    });
    view.rerender(
      <SectionFields
        section={{
          ...section,
          items: [{ ...section.items[0], current: true }],
        }}
        index={1}
        change={change}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("종료")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "항목 복제" }));
    const copy = change.mock.lastCall![0].items[1];
    expect(copy.id).not.toBe(section.items[0].id);
    expect(copy.end).toBe("2024.01");
    fireEvent.click(screen.getByRole("button", { name: "항목 삭제" }));
    expect(change.mock.lastCall![0].items).toEqual([]);
    view.rerender(
      <SectionFields
        section={{
          ...section,
          items: Array.from({ length: 20 }, () => ({
            ...section.items[0],
            id: crypto.randomUUID(),
          })),
        }}
        index={1}
        change={change}
        onError={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "+ 항목 추가 (20/20)" }),
    ).toBeDisabled();
    expect(
      screen
        .getAllByRole("button", { name: "항목 복제" })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});
