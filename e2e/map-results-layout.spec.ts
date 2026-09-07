import { expect, test, type Locator } from "@playwright/test";

import { installBoundaryFixture } from "./boundary-fixture";

async function expectReadableCards(cards: Locator, maxLines: number) {
  const metrics = await cards.evaluateAll((elements) =>
    elements.map((card) => {
      const title = card.querySelector("strong")!;
      const role = card.querySelector(".map-result-role")!;
      const local = card.querySelector(".map-result-local-name");
      const compare = card.querySelector(".comparison-toggle")!;
      const range = document.createRange();
      range.selectNodeContents(title);
      const titleBox = title.getBoundingClientRect();
      const roleBox = role.getBoundingClientRect();
      const compareBox = compare.getBoundingClientRect();
      const localBox = local?.getBoundingClientRect();
      return {
        name: title.textContent,
        lines: new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.y))).size,
        gap: titleBox.left - roleBox.right,
        overlapsCompare: titleBox.right > compareBox.left,
        localBelowTitle: !localBox || localBox.top >= titleBox.bottom - 1,
        localFits: !localBox || localBox.right <= compareBox.left,
        hasOverflow: card.scrollWidth > card.clientWidth
      };
    })
  );

  expect(metrics.length).toBeGreaterThan(0);
  for (const metric of metrics) {
    const context = JSON.stringify(metric);
    expect(metric.lines, context).toBeLessThanOrEqual(maxLines);
    expect(metric.gap, context).toBeGreaterThan(0);
    expect(metric.gap, context).toBeLessThanOrEqual(12);
    expect(metric.overlapsCompare, context).toBe(false);
    expect(metric.localBelowTitle, context).toBe(true);
    expect(metric.localFits, context).toBe(true);
    expect(metric.hasOverflow, context).toBe(false);
  }
}

test("地图长名称和原名在窄屏及桌面侧栏完整排布", async ({ page, isMobile }) => {
  await page.goto("/?view=map&scope=global");
  const results = page.getByRole("region", { name: "地图结果列表" });
  await expect(results.getByRole("button", { name: /^第一保加利亚帝国/ }).first()).toBeVisible();
  await expect(results.getByRole("button", { name: /^神圣罗马帝国/ }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const width of isMobile ? [320, 360, 375, 390, 412] : [1024, 1280]) {
      await test.step(`${colorScheme} / ${width}px`, async () => {
        await page.setViewportSize({ width, height: 915 });
        // 极窄卡片允许自然换行；375px 手机与1280px桌面应有足够空间。
        const maxLines = width >= 375 && width !== 1024 ? 1 : 2;
        await expectReadableCards(results.locator(".map-result-item"), maxLines);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
          )
        ).toBe(false);
      });
    }
  }
});

test("疆域与点位列表宽度一致且卡片之间留有间距", async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 375 : 1280, height: 915 });
  await installBoundaryFixture(page);
  await page.goto("/?view=map&scope=global&year=800&layer=combined");
  const results = page.getByRole("region", { name: "地图结果列表" });
  await expect(results.getByRole("button", { name: /^第一保加利亚帝国/ })).toBeVisible();
  await expect(
    results.getByRole("button", { name: /拜占庭帝国，800—1025，疆域示意/ })
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const metrics = await results.evaluate((element) => {
    const points = element.querySelector(".map-result-list")!;
    const boundaries = element.querySelector(".map-boundary-result-list")!;
    const point = points.firstElementChild!.getBoundingClientRect();
    const first = boundaries.children[0]!.getBoundingClientRect();
    const second = boundaries.children[1]!.getBoundingClientRect();
    return {
      leftDifference: first.left - point.left,
      widthDifference: first.width - point.width,
      cardGap: second.top - first.bottom,
      listGap: first.top - points.getBoundingClientRect().bottom,
      marker: getComputedStyle(boundaries.firstElementChild!).listStyleType
    };
  });
  expect(Math.abs(metrics.leftDifference)).toBeLessThan(1);
  expect(Math.abs(metrics.widthDifference)).toBeLessThan(1);
  expect(metrics.cardGap).toBeGreaterThanOrEqual(8);
  expect(metrics.listGap).toBeGreaterThanOrEqual(8);
  expect(metrics.marker).toBe("none");
  await expectReadableCards(results.locator(".map-result-item"), 1);

  const detail = results.getByRole("button", { name: /拜占庭帝国，800—1025，疆域示意/ });
  await detail.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "拜占庭帝国" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeFocused();
  await page.keyboard.press("Tab");
  const compare = results.locator(".map-boundary-result").getByRole("button", {
    name: /^将拜占庭帝国/
  });
  await expect(compare).toBeFocused();
  await page.keyboard.press("Space");
  await expect(compare).toHaveAttribute("aria-pressed", "true");
});
