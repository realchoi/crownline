import { expect, test } from "@playwright/test";

test("时间轴名称和固定快捷栏提供可达的详情与对比路径", async ({ page, isMobile }) => {
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
  const comparison = page.getByRole("complementary", { name: "对比工具" });
  await expect(comparison).toBeFocused();

  const comparisonHeading = page.getByRole("heading", { name: "政权时间对比" });
  const toolbar = page.locator(isMobile ? ".mobile-explore-bar" : ".compact-console-bar");
  const headingBox = await comparisonHeading.boundingBox();
  const toolbarBox = await toolbar.boundingBox();
  expect(headingBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y + toolbarBox!.height);

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
