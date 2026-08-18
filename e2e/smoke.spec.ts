import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";
import { expect, test, type Page } from "@playwright/test";

const tangTimelineButtonName = "唐，618—690，主线王朝。点击查看详情。";

async function waitForAppReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Crownline · 王冠纪" })).toBeVisible();
  await expect(page.getByText(/显示 \d+ \/ \d+ 个条目/)).toBeVisible();
}

async function expectNoCriticalA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const critical = results.violations.filter((violation) => violation.impact === "critical");
  expect(critical, formatViolations(critical)).toEqual([]);
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

test.describe("Crownline 浏览器冒烟", () => {
  test("桌面端加载时间轴并打开原生 dialog", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const tangBar = page.getByRole("button", { name: tangTimelineButtonName });
    await tangBar.click();
    await expect(page.getByRole("dialog", { name: "唐" })).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭详情" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "唐" })).toHaveCount(0);
    await expect(tangBar).toBeFocused();

    await expectNoCriticalA11yViolations(page);
  });

  test("手机布局保留筛选控件并支持键盘导航", async ({ page, isMobile }) => {
    test.skip(!isMobile, "仅在 mobile-chrome 项目运行");

    await page.goto("/");
    await waitForAppReady(page);

    await expect(page.getByRole("region", { name: "地区范围" })).toBeVisible();
    await expect(page.getByLabel("浏览与筛选工具")).toBeVisible();

    await page.getByPlaceholder("例如：唐、北魏、南宋、前221").fill("明");
    await expect(page.getByText(/显示 \d+ \/ \d+ 个条目/)).toBeVisible();

    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();

    await expectNoCriticalA11yViolations(page);
  });

  test("深色模式下地图视图可切换且无严重无障碍问题", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "深色模式探测仅在 Chromium 项目运行");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByRole("button", { name: "地图" }).click();
    await expect(page.getByRole("region", { name: "当前年份历史政权示意地图" })).toBeVisible();

    const pageBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    expect(pageBackground).not.toBe("rgb(255, 255, 255)");

    await expectNoCriticalA11yViolations(page);
  });
});
