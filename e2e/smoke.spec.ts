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
      "summary",
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
  await page.waitForTimeout(32);
  await page.locator("[data-e2e-tab-start]").focus();
  await expect(page.locator("[data-e2e-tab-start]")).toBeFocused();
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
  for (const colorScheme of ["light", "dark"] as const) {
    test(`详情发现关系并进入对比（${colorScheme}）`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(
        "/?view=map&mode=point&year=1292&scope=china&q=元&detail=polity-cn-yuan&custom=keep&compare=polity-cn-ming&compare=polity-cn-qing"
      );
      await waitForAppReady(page);
      const dialog = page.getByRole("dialog", { name: "元" });
      const related = dialog.getByRole("region", { name: "相关政权" });
      const entry = related.getByRole("button", { name: "进入对比：元与素可泰王国" });
      await expect(related.getByRole("list", { name: "素可泰王国的已校订关系" })).toContainText(
        "1292—1323"
      );
      await entry.scrollIntoViewIfNeeded();
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
      );
      expect(
        await dialog
          .locator(".dialog-body")
          .evaluate((element) => element.scrollWidth <= element.clientWidth)
      ).toBe(true);
      await expectNoSeriousA11yViolations(page);
      await page.screenshot({ path: testInfo.outputPath("related-polities.png") });
      await entry.focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("complementary", { name: "对比工具" })).toBeFocused();
      const relationships = page.getByRole("region", { name: "已校订历史关系" });
      await expect(relationships).toContainText("元与素可泰使节和工艺交流");
      const heading = page.getByRole("heading", { name: "政权时间对比" });
      const toolbar = page.locator(".mobile-explore-bar, .compact-console-slot");
      const headingBox = await heading.boundingBox();
      const toolbarBox = await toolbar.boundingBox();
      expect
        .soft(headingBox!.y, "对比标题不应被探索工具条遮挡")
        .toBeGreaterThanOrEqual(toolbarBox!.y + toolbarBox!.height);
      const slots = page.getByRole("group", { name: "已选对比政权" });
      const removeBox = await slots
        .getByRole("button", { name: /从对比中移除素可泰王国/ })
        .boundingBox();
      const localBox = await slots.getByText("สุโขทัย").boundingBox();
      expect
        .soft(removeBox!.y, "移除按钮应与主名称同行，原名单独位于下方")
        .toBeLessThan(localBox!.y);
      await page.screenshot({ path: testInfo.outputPath("related-comparison.png") });
      await expect(page).toHaveURL(/compare=polity-cn-yuan&compare=polity-sukhothai-kingdom/);
      expect(new URL(page.url()).searchParams.get("custom")).toBe("keep");
      expect(new URL(page.url()).searchParams.get("view")).toBe("map");
      expect(new URL(page.url()).searchParams.get("year")).toBe("1292");
      expect(new URL(page.url()).searchParams.get("q")).toBe("元");
      await expectNoSeriousA11yViolations(page);
      await page.goBack();
      await expect(dialog).toBeVisible();
      expect(new URL(page.url()).searchParams.getAll("compare")).toEqual([
        "polity-cn-ming",
        "polity-cn-qing"
      ]);
      await page.goForward();
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await expect(relationships).toContainText("元与素可泰使节和工艺交流");
    });
  }

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

  test("探索状态在刷新、后退和前进后与 URL 一致", async ({ page, isMobile }) => {
    await page.goto("/?view=map&year=800&scope=china&layer=boundaries");
    await waitForAppReady(page);
    const getControls = async () => {
      if (!isMobile) return page;
      const existing = page.getByRole("dialog", { name: "筛选与呈现" });
      if ((await existing.count()) === 0) {
        await page.getByRole("button", { name: /^筛选/ }).click();
      }
      return page.getByRole("dialog", { name: "筛选与呈现" });
    };
    let controls = await getControls();

    await expect(controls.getByRole("button", { name: "地图" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(controls.getByRole("button", { name: "指定年份" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(controls.getByLabel("当前年份", { exact: true })).toHaveText("800");
    await expect(controls.getByRole("button", { name: "中国" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(controls.getByRole("button", { name: "疆域示意" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.reload();
    await waitForAppReady(page);
    controls = await getControls();
    await expect(controls.getByLabel("当前年份", { exact: true })).toHaveText("800");
    await expect(controls.getByRole("button", { name: "中国" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.evaluate(() => {
      window.history.pushState(null, "", "/?scope=global");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(controls.getByRole("button", { name: "时间轴" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(controls.getByRole("button", { name: "全时期" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.goBack();
    await expect(controls.getByLabel("当前年份", { exact: true })).toHaveText("800");
    await expect(controls.getByRole("button", { name: "地图" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.goForward();
    await expect(controls.getByRole("button", { name: "全时期" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(controls.getByRole("button", { name: "全球已收录" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("手机布局保留筛选控件并支持键盘导航", async ({ page, isMobile }) => {
    test.skip(!isMobile, "仅在 mobile-chrome 项目运行");

    await page.goto("/");
    await waitForAppReady(page);

    const trigger = page.getByRole("button", { name: "筛选" });
    await expect(trigger).toBeVisible();
    await expect(page.getByRole("region", { name: "地区范围" })).toHaveCount(0);
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "筛选与呈现" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "关闭筛选" })).toBeFocused();
    await sheet.getByPlaceholder("例如：唐、北魏、南宋、前221").fill("明");
    await sheet.getByRole("button", { name: /查看 \d+ 个结果/ }).click();
    await expect(trigger).toBeFocused();
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
      .evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.getByRole("region", { name: "聚合历史点位" })).toBeVisible();
    await expect(page.locator(".historical-map")).toHaveClass(/is-cluster-expanded/);
    await expect
      .poll(() =>
        page.locator(".historical-map").evaluate((element) => getComputedStyle(element).position)
      )
      .toBe("static");
    await expectNoSeriousA11yViolations(page);
  });

  test("手机端聚合点位面板完整显示并可关闭", async ({ page, isMobile }) => {
    test.skip(!isMobile, "仅在 mobile-chrome 项目覆盖");

    await page.goto("/?view=map&year=1368&scope=global");
    await waitForAppReady(page);
    const cluster = page.getByRole("button", { name: /此处有 \d+ 个历史点位/ }).first();
    await cluster.evaluate((element) => (element as HTMLButtonElement).click());

    const panel = page.getByRole("region", { name: "聚合历史点位" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: "关闭聚合点位" })).toBeVisible();
    const box = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect((box?.width ?? 0) / (viewport?.width ?? 1)).toBeGreaterThan(0.8);
    expect((box?.height ?? 0) / (viewport?.height ?? 1)).toBeLessThan(0.6);
    await expectNoSeriousA11yViolations(page);
    await panel.getByRole("button", { name: "关闭聚合点位" }).click();
    await expect(panel).toHaveCount(0);
  });

  test("桌面端疆域图层恢复年份与 URL，并支持详情和双政权高亮", async ({ page, isMobile }) => {
    test.skip(isMobile, "桌面疆域图层交互仅在 desktop 项目覆盖");

    await page.goto("/?view=map&year=800&layer=boundaries");
    await waitForAppReady(page);
    await expect(page.getByRole("region", { name: "当前年份历史政权示意地图" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /拜占庭帝国，800—1025，疆域示意/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /阿拔斯哈里发，750—861，疆域示意/ })
    ).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("layer")).toBe("boundaries");

    await page
      .getByRole("button", { name: /将拜占庭帝国.*加入对比/ })
      .evaluate((element) => (element as HTMLButtonElement).click());
    await page
      .getByRole("button", { name: /将阿拔斯哈里发.*加入对比/ })
      .evaluate((element) => (element as HTMLButtonElement).click());
    await expect
      .poll(() => page.locator(".map-boundary-shape.is-comparison").count())
      .toBeGreaterThan(0);
    const comparedIds = await page
      .locator(".map-boundary-shape.is-comparison")
      .evaluateAll((paths) => [
        ...new Set(paths.map((path) => path.getAttribute("data-entity-id")))
      ]);
    expect(comparedIds).toEqual(
      expect.arrayContaining(["polity-byzantine-empire", "polity-abbasid-caliphate"])
    );

    await page
      .getByRole("button", { name: /拜占庭帝国，800—1025，疆域示意/ })
      .evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.getByRole("dialog", { name: "拜占庭帝国" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("手机端通过疆域结果列表完成详情和对比", async ({ page, isMobile }) => {
    test.skip(!isMobile, "仅在 mobile-chrome 项目运行");

    await page.goto("/?view=map&year=800&layer=boundaries");
    await waitForAppReady(page);
    const list = page.getByRole("region", { name: "地图结果列表" });
    await expect(
      list.getByRole("button", { name: /拜占庭帝国，800—1025，疆域示意/ })
    ).toBeVisible();
    await list.getByRole("button", { name: /将拜占庭帝国.*加入对比/ }).click();
    await list.getByRole("button", { name: /将阿拔斯哈里发.*加入对比/ }).click();
    await list.getByRole("button", { name: /拜占庭帝国，800—1025，疆域示意/ }).click();
    await expect(page.getByRole("dialog", { name: "拜占庭帝国" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )
      )
      .toBe(true);
  });

  test("全时期疆域图层提示选择年份而不绘制跨时代多边形", async ({ page }) => {
    await page.goto("/?view=map&layer=boundaries");
    await waitForAppReady(page);
    await expect(page.getByText(/疆域快照需要明确年份/).first()).toBeVisible();
    await expect(page.locator(".map-boundary-shape")).toHaveCount(0);
  });

  test("桌面端地图图层说明保持横向可读布局", async ({ page, isMobile }) => {
    test.skip(isMobile, "桌面横向控件布局仅在 desktop 项目覆盖");

    await page.goto("/?view=map");
    await waitForAppReady(page);
    const help = page.locator(".map-layer-help");
    const box = await help.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThan(240);
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(90);
  });

  test("全时期总览的清除筛选按钮在桌面端保持同行", async ({ page, isMobile }) => {
    test.skip(isMobile, "桌面网格布局仅在 desktop-chromium 项目覆盖");

    await page.goto("/");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "地图" }).click();

    const searchBox = await page.getByRole("searchbox").boundingBox();
    const clearBox = await page
      .getByRole("button", { name: "清除搜索与类别（控制台）" })
      .boundingBox();
    expect(searchBox).not.toBeNull();
    expect(clearBox).not.toBeNull();
    expect(Math.abs((searchBox?.y ?? 0) - (clearBox?.y ?? 0))).toBeLessThan(2);
  });

  test("桌面完整控制台滚出后切换为紧凑工具条并可返回", async ({ page, isMobile }) => {
    test.skip(isMobile, "桌面滚动控制台仅在 desktop 项目覆盖");

    await page.goto("/");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: "探索控制台" })).toBeVisible();
    await expect(page.getByRole("region", { name: "紧凑探索工具条" })).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 760));
    const toolbar = page.getByRole("region", { name: "紧凑探索工具条" });
    await expect(toolbar).toBeVisible();
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(64);

    await toolbar.getByRole("button", { name: "展开控制台" }).click();
    await expect(page.locator(".full-exploration-console")).toBeFocused();
    await expect(toolbar).toHaveCount(0);
  });

  test("移动筛选抽屉支持 Escape、焦点恢复和自选地区隔离", async ({ page, isMobile }) => {
    test.skip(!isMobile, "移动筛选抽屉仅在 mobile 项目覆盖");

    await page.goto("/");
    await waitForAppReady(page);
    const trigger = page.getByRole("button", { name: "筛选" });
    const barHeightBefore = await page
      .locator(".mobile-explore-bar")
      .evaluate((element) => element.getBoundingClientRect().height);
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "筛选与呈现" });
    await sheet.getByRole("button", { name: "自选地区" }).click();
    await expect(sheet.getByRole("checkbox", { name: "欧洲" })).toBeVisible();
    await expect(sheet.locator(".region-options")).toBeVisible();
    const barHeightAfter = await page
      .locator(".mobile-explore-bar")
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(barHeightAfter - barHeightBefore).toBeLessThan(64);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )
      )
      .toBe(true);
    await expectNoSeriousA11yViolations(page);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("活跃筛选标签可分别移除", async ({ page }) => {
    await page.goto("/?q=%E5%94%90&type=mainline&scope=custom&region=region-europe");
    await waitForAppReady(page);

    await page.getByRole("button", { name: "移除搜索：唐" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false);
    await page.getByRole("button", { name: "移除类别：主线王朝" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("type")).toBe(false);
    await page.getByRole("button", { name: "移除地区：欧洲" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("scope")).toBe(false);
    await expect(page.getByLabel("活跃筛选")).toHaveCount(0);
  });

  test("四个验收尺寸无横向溢出且移动端首屏可见结果", async ({ page, isMobile }) => {
    test.skip(isMobile, "尺寸矩阵在 desktop 项目单次覆盖");
    const sizes = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 }
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.goto("/");
      await waitForAppReady(page);
      const metrics = await page.evaluate(() => {
        const firstResult = document.querySelector(
          ".timeline-stage, .timepoint-card, .historical-map-shell"
        );
        return {
          firstResultTop: firstResult?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      });
      expect(metrics.hasOverflow, `${size.width}×${size.height} 出现横向溢出`).toBe(false);
      if (size.width <= 800) {
        expect(
          metrics.firstResultTop,
          `${size.width}×${size.height} 的首条结果未进入首个视口`
        ).toBeLessThan(size.height);
        await expect(page.getByRole("button", { name: "筛选" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "探索控制台" })).toBeVisible();
      }
    }
  });

  test("深色模式下地图视图可切换且无严重无障碍问题", async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== "chromium", "深色模式探测仅在 Chromium 项目运行");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await waitForAppReady(page);

    if (isMobile) {
      await page.getByRole("button", { name: "筛选" }).click();
      const sheet = page.getByRole("dialog", { name: "筛选与呈现" });
      await sheet.getByRole("button", { name: "地图" }).click();
      await sheet.getByRole("button", { name: /查看 \d+ 个结果/ }).click();
    } else {
      await page.getByRole("button", { name: "地图" }).click();
    }
    await expect(page.getByRole("region", { name: "全时期历史政权总览地图" })).toBeVisible();

    const pageBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    expect(pageBackground).not.toBe("rgb(255, 255, 255)");

    await expectNoSeriousA11yViolations(page);
  });
});
