import { expect, test, type Locator, type Page } from "@playwright/test";

async function openTimeControls(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) {
    // 桌面年份框常驻控制台的时间范围控件。
    return page.locator(".full-exploration-console").getByRole("region", { name: "时间范围" });
  }

  const dialog = page.getByRole("dialog", { name: "筛选条件" });
  if ((await dialog.count()) === 0) {
    await page.getByRole("button", { name: /^筛选/ }).click();
  }
  return dialog.getByRole("region", { name: "时间范围" });
}

test("精确年份跳转可分享，并在刷新和浏览器状态变化后恢复", async ({ page, isMobile }) => {
  await page.goto("/?mode=point&year=-221&custom=keep");
  await expect(page.getByRole("heading", { name: "Crownline · 王冠纪" })).toBeVisible();

  if (isMobile) {
    // 首屏常驻的紧凑时间控件同样保持 44px 触控目标，且不造成横向溢出。
    const bar = page.locator(".mobile-explore-bar").getByRole("region", { name: "时间范围" });
    await expect(bar.getByRole("textbox", { name: "年份" })).toHaveValue("221");
    for (const control of [
      bar.getByRole("button", { name: "全时期" }),
      bar.getByRole("combobox", { name: "纪元" }),
      bar.getByRole("textbox", { name: "年份" }),
      bar.getByRole("button", { name: "上一年" }),
      bar.getByRole("button", { name: "下一年" })
    ]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
    ).toBe(false);
  }

  let controls = await openTimeControls(page, isMobile);
  await expect(controls.getByRole("combobox", { name: "纪元" })).toHaveValue("bce");
  await expect(controls.getByRole("textbox", { name: "年份" })).toHaveValue("221");
  if (isMobile) {
    for (const control of [
      controls.getByRole("combobox", { name: "纪元" }),
      controls.getByRole("textbox", { name: "年份" }),
      controls.getByRole("button", { name: "全时期" })
    ]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page
        .locator(".filter-sheet-frame")
        .evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true);
  }

  await controls.getByRole("combobox", { name: "纪元" }).selectOption("ce");
  await controls.getByRole("textbox", { name: "年份" }).fill("618");
  await controls.getByRole("textbox", { name: "年份" }).press("Enter");

  await expect.poll(() => new URL(page.url()).searchParams.get("year")).toBe("618");
  expect(new URL(page.url()).searchParams.get("custom")).toBe("keep");

  await page.reload();
  controls = await openTimeControls(page, isMobile);
  await expect(controls.getByRole("combobox", { name: "纪元" })).toHaveValue("ce");
  await expect(controls.getByRole("textbox", { name: "年份" })).toHaveValue("618");

  await page.evaluate(() => {
    window.history.replaceState(null, "", "/?mode=point&year=-1&custom=keep");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(controls.getByRole("combobox", { name: "纪元" })).toHaveValue("bce");
  await expect(controls.getByRole("textbox", { name: "年份" })).toHaveValue("1");
});
