import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("时间轴名称和固定快捷栏提供可达的详情与对比路径", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?q=唐&custom=keep");
  await expect(page.getByRole("heading", { name: "Crownline · 王冠纪" })).toBeVisible();

  const nameButton = page.getByRole("button", { name: "查看唐详情" });
  await nameButton.scrollIntoViewIfNeeded();
  const nameBox = await nameButton.boundingBox();
  expect(nameBox!.height).toBeGreaterThanOrEqual(44);

  await nameButton.click();
  const dialog = page.getByRole("dialog", { name: "唐" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "关闭详情" }).click();
  await expect(nameButton).toBeFocused();

  const toggle = page.getByRole("button", { name: "将唐加入对比" });
  await toggle.scrollIntoViewIfNeeded();
  const scrollBeforeSelection = await page.evaluate(() => window.scrollY);
  await toggle.click();

  const tray = page.getByRole("complementary", { name: "对比快捷栏" });
  await expect(tray).toBeVisible();
  await expect(tray).toContainText("已选 1/2");
  await expect(tray).toContainText("唐");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(scrollBeforeSelection, 0);

  const remove = tray.getByRole("button", { name: "从对比快捷栏移除唐" });
  const removeBox = await remove.boundingBox();
  expect(removeBox!.width).toBeGreaterThanOrEqual(44);
  expect(removeBox!.height).toBeGreaterThanOrEqual(44);

  await tray.getByRole("button", { name: "查看对比" }).click();
  const comparison = page.getByRole("dialog", { name: "政权时间对比" });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole("button", { name: "关闭对比" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(comparison).toHaveCount(0);
  await expect(tray.getByRole("button", { name: "查看对比" })).toBeFocused();

  const footerLink = page.getByRole("link", { name: "中国国家博物馆" });
  await footerLink.evaluate((element) => element.scrollIntoView({ block: "end" }));
  const footerLinkBox = await footerLink.boundingBox();
  const trayFrameBox = await tray.locator(".comparison-tray-frame").boundingBox();
  expect(footerLinkBox!.y + footerLinkBox!.height).toBeLessThanOrEqual(trayFrameBox!.y);

  await remove.click();
  await expect(tray).toHaveCount(0);
  await expect(page).toHaveURL(/custom=keep/);
  expect(new URL(page.url()).searchParams.has("compare")).toBe(false);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`对比弹窗保留浏览位置、独立滚动及键盘焦点（${colorScheme}）`, async ({
    page,
    isMobile
  }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/?compare=polity-cn-yuan&compare=polity-sukhothai-kingdom&custom=keep");
    await page.getByRole("button", { name: "查看元详情" }).scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => window.scrollY);
    expect(position).toBeGreaterThan(100);
    const view = page.getByRole("button", { name: "查看对比" });
    const dialog = page.getByRole("dialog", { name: "政权时间对比" });
    await expect(dialog).toHaveCount(0);
    await view.click();
    await expect(dialog.getByRole("region", { name: "已校订历史关系" })).toContainText("朝贡");
    const close = dialog.getByRole("button", { name: "关闭对比" });
    await expect(close).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    );
    if (isMobile) {
      const box = await dialog.boundingBox();
      expect(box!.y).toBe(0);
      expect(box!.height).toBe(page.viewportSize()!.height);
    }
    const body = dialog.locator(".comparison-dialog-body");
    const closeBefore = await close.boundingBox();
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await close.boundingBox()).toEqual(closeBefore);
    await page.mouse.move(2, 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
    // 在首个按钮向后循环，焦点仍须留在模态框中。
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(
      accessibility.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
    ).toEqual([]);
    await body.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({ path: testInfo.outputPath("comparison-dialog.png") });
    await close.click();
    await expect(view).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
    expect(new URL(page.url()).searchParams.getAll("compare")).toHaveLength(2);
    expect(new URL(page.url()).searchParams.has("comparison")).toBe(false);
    await view.click();
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await page.goForward();
    await expect(dialog).toBeVisible();
    await page.reload();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(view).toBeFocused();
    await view.click();
    await dialog.getByRole("button", { name: "清空对比" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("main")).toBeFocused();
    expect(new URL(page.url()).searchParams.has("compare")).toBe(false);
    expect(new URL(page.url()).searchParams.get("custom")).toBe("keep");
  });
}
