import type { Page } from "@playwright/test";

import { createBoundaryFixture } from "../tests/helpers/boundaryFixtures";

/** Only positive rendering tests replace the retired production boundaries. */
export async function installBoundaryFixture(page: Page) {
  await page.route("**/data/generated/boundaries.json", async (route) => {
    await route.fulfill({ json: createBoundaryFixture() });
  });
}
