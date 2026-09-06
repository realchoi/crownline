import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppBootstrap } from "../../src/app/AppBootstrap";
import type { CrownlineIndex } from "../../src/domain/types";
import { setupUser } from "../helpers/user";

const data = {} as CrownlineIndex;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("应用启动", () => {
  it("网络加载失败时提供可用的重试并在成功后进入应用", async () => {
    const user = setupUser();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loadIndex = vi
      .fn<() => Promise<CrownlineIndex>>()
      .mockRejectedValueOnce(new Error("首屏数据请求失败：HTTP 503"))
      .mockResolvedValue(data);

    render(<AppBootstrap loadIndex={loadIndex} renderApp={() => <p>应用已加载</p>} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("无法加载历史数据");
    expect(alert).toHaveTextContent("请检查网络连接");
    expect(alert).not.toHaveTextContent("npm run");
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("应用已加载")).toBeInTheDocument();
    expect(loadIndex).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("校验失败时说明数据无法读取并保留重试入口", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loadIndex = vi
      .fn<() => Promise<CrownlineIndex>>()
      .mockRejectedValue(new Error("首屏索引校验失败：/schemaVersion 只支持数据版本 5"));

    render(<AppBootstrap loadIndex={loadIndex} renderApp={() => <p>应用已加载</p>} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("历史数据无法读取");
    expect(alert).toHaveTextContent("数据格式或版本");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeEnabled();
  });
});
