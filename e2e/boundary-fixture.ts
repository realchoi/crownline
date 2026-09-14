import type { Page } from "@playwright/test";

import type { CrownlineIndex } from "../src/domain/types";
import { createBoundaryFixture } from "../tests/helpers/boundaryFixtures";

/** Only positive rendering tests replace the retired production boundaries. */
export async function installBoundaryFixture(page: Page) {
  const fixture = createBoundaryFixture();
  await page.route("**/data/generated/index.json", async (route) => {
    const response = await route.fetch();
    const index = (await response.json()) as CrownlineIndex;
    await route.fulfill({
      json: { ...index, boundarySnapshotCount: fixture.boundarySnapshots.length }
    });
  });
  await page.route("**/data/generated/boundaries.json", async (route) => {
    await route.fulfill({ json: fixture });
  });
}
