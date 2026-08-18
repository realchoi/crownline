import userEvent, { PointerEventsCheckLevel, type Options } from "@testing-library/user-event";

/** 集成测试默认关闭 delay 与 pointerEventsCheck，避免大 DOM 在 CI 上超时。 */
export function setupUser(options?: Options) {
  return userEvent.setup({
    delay: null,
    pointerEventsCheck: PointerEventsCheckLevel.Never,
    ...options
  });
}
