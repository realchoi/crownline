import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";
import { expect, test, type Page } from "@playwright/test";

const tangTimelineButtonName = "唐，618—690，主线王朝。点击查看详情。";

async function waitForAppReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Crownline · 王冠纪" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  expect(serious, formatViolations(serious)).toEqual([]);
}

function formatViolations(violations: Result[]) {
  if (violations.length === 0) return "";
  return violations
    .map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes
          .map((node) => node.target.join(" "))
          .join("\n")}`
    )
    .join("\n\n");
}

async function expectCompleteTabOrder(page: Page) {
  const tabbableCount = await page.evaluate(() => {
    const start = document.createElement("button");
    start.type = "button";
    start.setAttribute("aria-label", "E2E Tab 顺序起点");
    start.setAttribute("data-e2e-tab-start", "");
    start.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;";
    document.body.prepend(start);

    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])'
    ].join(",");
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => {
        const style = getComputedStyle(element);
        return (
          !element.hasAttribute("data-e2e-tab-start") &&
          !element.closest("[inert]") &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0
        );
      }
    );
    elements.forEach((element, index) => element.setAttribute("data-e2e-tab-order", String(index)));
    start.focus();
    return elements.length;
  });

  expect(tabbableCount).toBeGreaterThan(10);
  for (let index = 0; index < tabbableCount; index += 1) {
    await page.keyboard.press("Tab");
    const activeIndex = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-e2e-tab-order")
    );
    expect(activeIndex, `第 ${index + 1} 个 Tab 停靠点顺序错误`).toBe(String(index));
  }
  await page.evaluate(() => document.querySelector("[data-e2e-tab-start]")?.remove());
}

test.describe("Crownline 浏览器冒烟", () => {
  test("桌面端加载时间轴并打开原生 dialog", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const tangBar = page.getByRole("button", { name: tangTimelineButtonName });
    await tangBar.click();
    await expect(page.getByRole("dialog", { name: "唐" })).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭详情" })).toBeFocused();
    await expectNoSeriousA11yViolations(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "唐" })).toHaveCount(0);
    await expect(tangBar).toBeFocused();

    await expectNoSeriousA11yViolations(page);
  });

  test("详情深链接支持关闭、后退恢复和前进关闭", async ({ page }) => {
    await page.goto("/?detail=polity-cn-tang");
    await waitForAppReady(page);

    await expect(page.getByRole("dialog", { name: "唐" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("detail")).toBe("polity-cn-tang");

    await page.getByRole("button", { name: "关闭详情" }).click();
    await expect(page.getByRole("dialog", { name: "唐" })).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get("detail")).toBeNull();

    await page.goBack();
    await expect(page.getByRole("dialog", { name: "唐" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("detail")).toBe("polity-cn-tang");

    await page.goForward();
    await expect(page.getByRole("dialog", { name: "唐" })).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get("detail")).toBeNull();
  });

  test("手机布局保留筛选控件并支持键盘导航", async ({ page, isMobile }) => {
    test.skip(!isMobile, "仅在 mobile-chrome 项目运行");

    await page.goto("/");
    await waitForAppReady(page);

    await expect(page.getByRole("region", { name: "地区范围" })).toBeVisible();
    await expect(page.getByLabel("浏览与筛选工具")).toBeVisible();

    await page.getByPlaceholder("例如：唐、北魏、南宋、前221").fill("明");
    await expect(page.getByText(/显示 \d+ \/ \d+ 个条目/)).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )
      )
      .toBe(true);

    await expectCompleteTabOrder(page);

    await expectNoSeriousA11yViolations(page);
  });

  test("地图聚合弹层打开时无严重无障碍问题", async ({ page, isMobile }) => {
    test.skip(isMobile, "聚合弹层在桌面项目覆盖");

    await page.goto("/?view=map&year=1368&scope=global");
    await waitForAppReady(page);
    await expect(page.getByRole("region", { name: "当前年份历史政权示意地图" })).toBeVisible();

    await page
      .getByRole("button", { name: /此处有 \d+ 个历史点位/ })
      .first()
      .click();
    await expect(page.getByRole("region", { name: "聚合历史点位" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("全时期总览的清除筛选按钮在桌面端保持同行", async ({ page, isMobile }) => {
    test.skip(isMobile, "桌面网格布局仅在 desktop-chromium 项目覆盖");

    await page.goto("/");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "地图" }).click();

    const searchBox = await page.getByRole("searchbox").boundingBox();
    const clearBox = await page.getByRole("button", { name: "清除筛选" }).boundingBox();
    expect(searchBox).not.toBeNull();
    expect(clearBox).not.toBeNull();
    expect(Math.abs((searchBox?.y ?? 0) - (clearBox?.y ?? 0))).toBeLessThan(2);
  });

  test("深色模式下地图视图可切换且无严重无障碍问题", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "深色模式探测仅在 Chromium 项目运行");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByRole("button", { name: "地图" }).click();
    await expect(page.getByRole("region", { name: "全时期历史政权总览地图" })).toBeVisible();

    const pageBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    expect(pageBackground).not.toBe("rgb(255, 255, 255)");

    await expectNoSeriousA11yViolations(page);
  });
});
