import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InvoicePrintPage from "./SCR-INVOICE-PRINT";
import { invoiceCopyApi } from "./invoiceCopyApi";
import type { InvoicePrintDocument } from "./contracts";

vi.mock("./invoiceCopyApi", () => ({ invoiceCopyApi: { get: vi.fn() } }));
const api = vi.mocked(invoiceCopyApi);
let data: InvoicePrintDocument;

beforeEach(() => {
  data = {
    id: "27",
    user_id: "1",
    doc_type: "quote",
    doc_no: "Q-2026-0001",
    source_quote_id: null,
    title: "제목",
    paid: false,
    deleted: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    supply_amount: 3000000,
    vat_amount: 300000,
    total_amount: 3300000,
    content: {
      supplier: { name: "공급자", bizNo: "", ceo: "", address: "", phone: "" },
      client: { name: "수신자", contact: "" },
      issueDate: "2026-01-01",
      items: [],
      vatMode: "separate",
      notes: "보존할 긴 비고",
      stampPhotoId: null,
      color: "#1F3A5F",
    },
  };
  api.get.mockResolvedValue(data);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(document, "fonts", {
    value: undefined,
    configurable: true,
  });
});

/** Renderer boundary double: layout is the editor owner's responsibility, readiness is this test's boundary. */
function DocumentBoundary({
  value,
  ready,
  stamp = false,
}: {
  value: InvoicePrintDocument;
  ready: () => void;
  stamp?: boolean;
}) {
  useEffect(() => {
    ready();
  }, [ready]);
  return (
    <article>
      <h1>{value.doc_no}</h1>
      <p>{value.content.notes}</p>
      <p>{value.total_amount}</p>
      {stamp && (
        <img src={`/api/photos/${value.content.stampPhotoId}`} alt="직인" />
      )}
    </article>
  );
}
function open(stamp = false) {
  const router = createMemoryRouter(
    [
      {
        path: "/print/invoice/:id",
        element: (
          <InvoicePrintPage
            renderDocument={(value, ready) => (
              <DocumentBoundary value={value} ready={ready} stamp={stamp} />
            )}
          />
        ),
      },
    ],
    { initialEntries: ["/print/invoice/27"] },
  );
  render(<RouterProvider router={router} />);
}

it("direct print tabs never GET private data or print", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open();
  expect(
    screen.getByText("인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다."),
  ).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
  expect(print).not.toHaveBeenCalled();
});

it("iframe GETs selected ID, awaits fonts, then uses stored amounts and number_recipient title exactly once", async () => {
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
  open();
  await screen.findByRole("heading", { name: "Q-2026-0001" });
  expect(api.get).toHaveBeenCalledWith("27");
  expect(print).not.toHaveBeenCalled();
  expect(screen.getByText("3300000")).toBeInTheDocument();
  expect(screen.getByText(data.content.notes)).toBeInTheDocument();
  await act(async () => release());
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(document.title).toBe("Q-2026-0001_수신자");
  act(() => window.dispatchEvent(new Event("afterprint")));
  expect(message).toHaveBeenCalledWith(
    { type: "invoice-print-finished" },
    window.location.origin,
  );
});

it.each(["401", "404", "조회 실패"])(
  "GET failure %s aborts print and informs parent",
  async (failure) => {
    vi.stubGlobal("self", {});
    api.get.mockRejectedValue(new Error(failure));
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const message = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(failure);
    expect(print).not.toHaveBeenCalled();
    expect(message).toHaveBeenCalledWith(
      { type: "invoice-print-error" },
      window.location.origin,
    );
  },
);

it("a response for another document is never rendered or printed", async () => {
  vi.stubGlobal("self", {});
  data.id = "28";
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open();
  await screen.findByRole("alert");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(print).not.toHaveBeenCalled();
});

it("rejected font readiness never prints", async () => {
  vi.stubGlobal("self", {});
  let reject!: (error: Error) => void;
  Object.defineProperty(document, "fonts", {
    value: {
      ready: new Promise<void>((_, failure) => {
        reject = failure;
      }),
    },
    configurable: true,
  });
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open();
  await screen.findByRole("heading");
  await act(async () => reject(new Error("폰트 실패")));
  expect(await screen.findByRole("alert")).toHaveTextContent("폰트 실패");
  expect(print).not.toHaveBeenCalled();
});

it("stamp must be mounted by renderer; missing stamp blocks output", async () => {
  vi.stubGlobal("self", {});
  data.content.stampPhotoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("직인 이미지");
  expect(print).not.toHaveBeenCalled();
});

it("stamp image load failure prevents printing", async () => {
  vi.stubGlobal("self", {});
  data.content.stampPhotoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open(true);
  const image = await screen.findByRole("img", { name: "직인" });
  act(() => image.dispatchEvent(new Event("error")));
  expect(await screen.findByRole("alert")).toHaveTextContent("사진");
  expect(print).not.toHaveBeenCalled();
});
