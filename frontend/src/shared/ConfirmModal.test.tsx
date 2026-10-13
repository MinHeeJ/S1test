import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ConfirmModal } from "./ConfirmModal";

it("cancel preserves data without executing deletion", () => {
  const remove = vi.fn();
  const cancel = vi.fn();
  render(
    <ConfirmModal
      title="삭제"
      message="이력서를 삭제할까요?"
      onCancel={cancel}
      onConfirm={remove}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
});
it("failed confirmation stays visible with the error", async () => {
  const cancel = vi.fn();
  render(
    <ConfirmModal
      title="삭제"
      message="확인"
      onCancel={cancel}
      onConfirm={async () => {
        throw new Error("삭제 실패");
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("삭제 실패");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(cancel).not.toHaveBeenCalled();
});
it("pending confirmation disables repeated submission and cancellation", () => {
  const remove = vi.fn(() => new Promise<void>(() => undefined));
  render(
    <ConfirmModal
      title="삭제"
      message="확인"
      onCancel={vi.fn()}
      onConfirm={remove}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  expect(remove).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
});
it("Escape cancels and keyboard focus stays within the modal", () => {
  const cancel = vi.fn();
  render(
    <ConfirmModal
      title="삭제"
      message="확인"
      onCancel={cancel}
      onConfirm={vi.fn()}
    />,
  );
  const cancelButton = screen.getByRole("button", { name: "취소" });
  const confirmButton = screen.getByRole("button", { name: "삭제 확인" });
  expect(cancelButton).toHaveFocus();
  fireEvent.keyDown(cancelButton, { key: "Tab", shiftKey: true });
  expect(confirmButton).toHaveFocus();
  fireEvent.keyDown(confirmButton, { key: "Escape" });
  expect(cancel).toHaveBeenCalledOnce();
});
