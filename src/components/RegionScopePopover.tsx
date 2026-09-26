import { useEffect, useId, useRef, useState } from "react";

import { getRegionScopeLabel, type RegionScope } from "../domain/regionScope";
import type { Region } from "../domain/types";
import { RegionScopeControl } from "./RegionScopeControl";

interface RegionScopePopoverProps {
  regions: Region[];
  scope: RegionScope;
  onChange: (scope: RegionScope) => void;
}

/**
 * 桌面工具条的观测范围：触发按钮显示当前范围，展开后是预设、覆盖说明与地区多选。
 * 选中国或全球后自动收起；Escape、点外部或焦点移出时收起，Escape 与预设选择会把焦点还给触发按钮。
 */
export function RegionScopePopover({ regions, scope, onChange }: RegionScopePopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="region-scope-popover-wrap"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          close(true);
        }
      }}
      onBlur={(event) => {
        if (open && !wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        className="region-scope-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="region-scope-trigger-label">观测范围</span>
        <strong>{getRegionScopeLabel(scope, regions)}</strong>
        <span className="region-scope-trigger-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div ref={panelRef} id={panelId} className="region-scope-popover">
          <RegionScopeControl
            regions={regions}
            scope={scope}
            onChange={(next) => {
              onChange(next);
              // 自选地区还要勾选具体地区，保持展开。
              if (next.mode !== "custom") close(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
