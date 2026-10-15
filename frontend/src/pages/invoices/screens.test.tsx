import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationRoutes } from "../../app/router";
import { useSessionStore } from "../../app/sessionStore";
import { invoiceScreens } from "./screens";
import { invoicesApi } from "./invoicesApi";
import { testInvoice } from "./testInvoice";
import { InvoiceRenderer } from "./InvoiceRenderer";
import InvoicePrintPage, { invoiceImagesReady } from "./SCR-INVOICE-PRINT";

vi.mock("./invoicesApi", () => ({
  invoicesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    convert: vi.fn(),
    uploadPhoto: vi.fn(),
  },
}));
const api = vi.mocked(invoicesApi);
beforeEach(() => {
  useSessionStore.setState({
    user: { nickname: "지우" },
    status: "authenticated",
    error: null,
  });
  api.list.mockResolvedValue({
    items: [testInvoice()],
    page: 1,
    size: 20,
    total: 1,
  });
  api.get.mockResolvedValue(testInvoice());
  api.create.mockResolvedValue({ id: "28" });
  api.save.mockResolvedValue(undefined);
  api.delete.mockResolvedValue(undefined);
  api.convert.mockResolvedValue({ id: "28" });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function open(path = "/invoices") {
  const router = createMemoryRouter(applicationRoutes(invoiceScreens), {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}
it("authorized header entry reaches API-backed list and selected editor; root landing remains resumes", async () => {
  const router = open("/invoices");
  await screen.findByRole("link", { name: "홈페이지 견적" });
  expect(screen.getByTestId("menu-resumes")).toHaveAttribute(
    "href",
    "/resumes",
  );
  fireEvent.click(screen.getByTestId("menu-invoices"));
  await waitFor(() => expect(router.state.location.pathname).toBe("/invoices"));
  fireEvent.click(screen.getByRole("link", { name: "홈페이지 견적" }));
  await screen.findByLabelText("공급자 상호");
  expect(router.state.location.pathname).toBe("/invoices/27/edit");
  expect(api.get).toHaveBeenCalledWith("27");
  expect(screen.queryByText("완성도")).not.toBeInTheDocument();
});
it("list tabs and paging use real filters, paid badge only on invoice", async () => {
  const row = testInvoice();
  row.doc_type = "invoice";
  row.paid = true;
  api.list.mockResolvedValue({ items: [row], page: 1, size: 20, total: 21 });
  open();
  await screen.findByText("입금 완료");
  fireEvent.click(screen.getByTestId("invoice-filter-invoice"));
  await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("invoice", 1));
  await screen.findByRole("link", { name: "홈페이지 견적" });
  fireEvent.click(screen.getByTestId("invoice-next"));
  await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("invoice", 2));
});
it("delete cancel preserves page and never calls DELETE; confirm refreshes", async () => {
  open();
  await screen.findByRole("link", { name: "홈페이지 견적" });
  fireEvent.click(screen.getByTestId("invoice-delete-27"));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
  );
  expect(api.delete).not.toHaveBeenCalled();
  expect(api.list).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId("invoice-delete-27"));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "삭제 확인",
    }),
  );
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith("27"));
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
});
it("create uses chosen kind then navigates to returned identity", async () => {
  const router = open();
  await screen.findByRole("link", { name: "홈페이지 견적" });
  fireEvent.click(screen.getByTestId("create-invoice"));
  await waitFor(() => expect(api.create).toHaveBeenCalledWith("invoice"));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/invoices/28/edit"),
  );
});
it("empty and failed list have distinct states and retry", async () => {
  api.list.mockRejectedValueOnce(new Error("목록 조회 실패"));
  api.list.mockResolvedValue({ items: [], page: 1, size: 20, total: 0 });
  open();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByTestId("invoice-list-retry"));
  await screen.findByText(
    "문서가 없습니다. 새 견적서 또는 청구서를 만들어 보세요.",
  );
});
it("editor failure does not show forms or permit mutations", async () => {
  api.get.mockRejectedValue(new Error("문서를 찾을 수 없습니다."));
  open("/invoices/27/edit");
  await screen.findByText("문서를 찾을 수 없습니다.");
  expect(screen.queryByLabelText("제목")).not.toBeInTheDocument();
  expect(api.save).not.toHaveBeenCalled();
});
it("PDF missing modal focuses actual input, close preserves values and never creates frame", async () => {
  const row = testInvoice();
  row.content.client.name = "";
  api.get.mockResolvedValue(row);
  open("/invoices/27/edit");
  await screen.findByLabelText("수신자 상호");
  fireEvent.click(screen.getByTestId("invoice-pdf"));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "수신자 · 상호",
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("수신자 상호")).toHaveFocus(),
  );
  expect(document.querySelector("iframe")).toBeNull();
  expect(api.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("invoice-pdf"));
  fireEvent.click(screen.getByTestId("invoice-missing-close"));
  expect(screen.getByLabelText("수신자 상호")).toHaveValue("");
});
it("title and paid use same PUT lane; invoice paid remains checked during body edits", async () => {
  const row = testInvoice();
  row.doc_type = "invoice";
  row.paid = true;
  api.get.mockResolvedValue(row);
  open("/invoices/27/edit");
  await screen.findByLabelText("제목");
  expect(screen.queryByTestId("invoice-convert")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "입금 후 수정" },
  });
  fireEvent.click(screen.getByTestId("invoice-save"));
  await waitFor(() =>
    expect(api.save).toHaveBeenCalledWith(
      "27",
      expect.objectContaining({
        title: "입금 후 수정",
        paid: true,
      }),
    ),
  );
  fireEvent.click(screen.getByTestId("invoice-paid"));
  fireEvent.click(screen.getByTestId("invoice-save"));
  await waitFor(() =>
    expect(api.save).toHaveBeenLastCalledWith(
      "27",
      expect.objectContaining({ paid: false }),
    ),
  );
});
it("in-flight changes are drained before convert, failure blocks navigation and print", async () => {
  let release!: () => void;
  api.save.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
  );
  const router = open("/invoices/27/edit");
  await screen.findByLabelText("제목");
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "첫 변경" },
  });
  fireEvent.click(screen.getByTestId("invoice-save"));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "최신" },
  });
  await act(async () => release());
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByTestId("invoice-convert"));
  await waitFor(() => expect(api.convert).toHaveBeenCalledWith("27"));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/invoices/28/edit"),
  );
});
it("failed save retains input and prevents PDF, menu and convert until retry", async () => {
  api.save.mockRejectedValue(new Error("저장 연결 실패"));
  const router = open("/invoices/27/edit");
  await screen.findByLabelText("제목");
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "보존" },
  });
  fireEvent.click(screen.getByTestId("invoice-pdf"));
  await screen.findByTestId("invoice-editor-error");
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByTestId("invoice-convert"));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  expect(api.convert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("menu-resumes"));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(3));
  expect(router.state.location.pathname).toBe("/invoices/27/edit");
  expect(screen.getByLabelText("제목")).toHaveValue("보존");
});
it("item boundaries, order identity and live totals are maintained", async () => {
  open("/invoices/27/edit");
  await screen.findByLabelText("제목");
  fireEvent.change(screen.getByTestId("item-line-one-qty"), {
    target: { value: "100000" },
  });
  expect(screen.getByTestId("item-line-one-qty")).toHaveValue(1);
  fireEvent.change(screen.getByTestId("item-line-one-qty"), {
    target: { value: "" },
  });
  expect(screen.getByTestId("item-line-one-qty")).toHaveValue(0);
  expect(
    within(screen.getByTestId("invoice-renderer")).getByText("일금 영원정"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("add-item"));
  expect(screen.getAllByText(/품목 [12]$/)).toHaveLength(2);
  fireEvent.click(screen.getByTestId("item-down-line-one"));
  fireEvent.click(screen.getByTestId("invoice-save"));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(api.save.mock.calls.at(-1)?.[1].content.items[1].id).toBe("line-one");
});
it("renderer keeps fifty rows and long notes, saved totals and stamp contain styling are independent of resume", () => {
  const row = testInvoice();
  row.content.items = Array.from({ length: 50 }, (_, n) => ({
    ...row.content.items[0],
    id: String(n),
    name: `품명 ${n}`,
  }));
  row.content.notes = "긴 비고\n".repeat(300);
  row.content.stampPhotoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  render(<InvoiceRenderer invoice={row} saved />);
  expect(screen.getByText("품명 49")).toBeInTheDocument();
  expect(
    screen.getByTestId("invoice-renderer").querySelectorAll("tbody tr"),
  ).toHaveLength(50);
  expect(screen.getByText("일금 삼백삼십만원정")).toBeInTheDocument();
  expect(screen.getByAltText("공급자 직인")).toHaveClass("invoice-stamp");
});
it("direct print never fetches or prints private content", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  render(<InvoicePrintPage />);
  expect(screen.getByText(/인쇄 화면은 편집기/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
  expect(print).not.toHaveBeenCalled();
});
it("image preparation rejects failed images rather than printing", async () => {
  const root = document.createElement("div");
  const image = document.createElement("img");
  root.append(image);
  await expect(invoiceImagesReady(root)).rejects.toThrow(
    "직인을 불러오지 못했습니다.",
  );
});

it("framed print waits for fonts then prints saved amounts with doc_no_client filename", async () => {
  vi.stubGlobal("self", {});
  let release!: () => void;
  Object.defineProperty(document, "fonts", {
    value: {
      ready: new Promise<void>((resolve) => {
        release = resolve;
      }),
    },
    configurable: true,
  });
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const message = vi
    .spyOn(window.parent, "postMessage")
    .mockImplementation(() => undefined);
  open("/print/invoice/27");
  await screen.findByTestId("invoice-print-page");
  expect(print).not.toHaveBeenCalled();
  await act(async () => release());
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(document.title).toBe("Q-2026-0001_수신자");
  window.dispatchEvent(new Event("afterprint"));
  expect(message).toHaveBeenCalledWith(
    { type: "invoice-print-finished" },
    window.location.origin,
  );
  Object.defineProperty(document, "fonts", {
    value: undefined,
    configurable: true,
  });
});
it("framed private GET failure sends error and never prints", async () => {
  vi.stubGlobal("self", {});
  api.get.mockRejectedValue(new Error("조회 실패"));
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const message = vi
    .spyOn(window.parent, "postMessage")
    .mockImplementation(() => undefined);
  open("/print/invoice/27");
  expect(await screen.findByRole("alert")).toHaveTextContent("조회 실패");
  expect(print).not.toHaveBeenCalled();
  expect(message).toHaveBeenCalledWith(
    { type: "invoice-print-error" },
    window.location.origin,
  );
});
it("PDF drains in-flight revisions then rechecks required values changed during saving", async () => {
  let release!: () => void;
  api.save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  open("/invoices/27/edit");
  await screen.findByLabelText("제목");
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "새 제목" },
  });
  fireEvent.click(screen.getByTestId("invoice-pdf"));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.change(screen.getByLabelText("수신자 상호"), {
    target: { value: "" },
  });
  await act(async () => release());
  await screen.findByRole("dialog", { name: "빠진 항목" });
  expect(api.save).toHaveBeenCalledTimes(2);
  expect(api.save.mock.calls[1][1].content.client.name).toBe("");
  expect(document.querySelector("iframe")).toBeNull();
});
it("failed stamp upload keeps the original photo connection", async () => {
  const row = testInvoice();
  row.content.stampPhotoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  api.get.mockResolvedValue(row);
  api.uploadPhoto.mockRejectedValue(new Error("이미지 업로드 실패"));
  open("/invoices/27/edit");
  await screen.findByLabelText("제목");
  const file = new File([new Uint8Array([1, 2, 3])], "stamp.png", {
    type: "image/png",
  });
  fireEvent.change(screen.getByTestId("invoice-stamp-upload"), {
    target: { files: [file] },
  });
  await screen.findByTestId("invoice-editor-error");
  expect(screen.getByAltText("공급자 직인")).toHaveAttribute(
    "src",
    `/api/photos/${row.content.stampPhotoId}`,
  );
  expect(api.save).not.toHaveBeenCalled();
});
