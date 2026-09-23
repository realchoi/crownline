import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useModalDialog } from "../src/components/useModalDialog";

function TestDialog({ open, onClose }: { open?: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalDialog(dialogRef, {
    ...(open === undefined ? {} : { open }),
    onClose,
    initialFocusRef: closeRef
  });
  return (
    <dialog ref={dialogRef} aria-label="测试对话框">
      <button ref={closeRef} type="button">
        关闭
      </button>
      <button type="button">末尾</button>
    </dialog>
  );
}

describe("useModalDialog", () => {
  it("挂载即打开并聚焦初始元素，卸载时收起", () => {
    const { unmount } = render(<TestDialog onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "测试对话框" }) as HTMLDialogElement;

    expect(dialog.open).toBe(true);
    expect(screen.getByRole("button", { name: "关闭" })).toHaveFocus();
    unmount();
    expect(dialog.open).toBe(false);
  });

  it("受控开关：关闭时收起，重新打开时再次聚焦", () => {
    const { rerender } = render(<TestDialog open={false} onClose={vi.fn()} />);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.open).toBe(false);

    rerender(<TestDialog open onClose={vi.fn()} />);
    expect(dialog.open).toBe(true);
    expect(screen.getByRole("button", { name: "关闭" })).toHaveFocus();

    rerender(<TestDialog open={false} onClose={vi.fn()} />);
    expect(dialog.open).toBe(false);
  });

  it("Escape 与 cancel 都调用最新的关闭回调", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<TestDialog onClose={first} />);
    rerender(<TestDialog onClose={latest} />);

    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent(document.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(2);
  });

  it("关闭状态下不响应 Escape", () => {
    const onClose = vi.fn();
    render(<TestDialog open={false} onClose={onClose} />);

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
