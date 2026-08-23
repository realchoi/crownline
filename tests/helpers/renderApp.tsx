import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { loadSourceData } from "../../scripts/data-source";
import { App } from "../../src/app/App";
import { buildGeneratedArtifacts } from "../../src/data/artifacts";
import type { CrownlineDetail } from "../../src/domain/types";
import type { CrownlineGeographyLoader } from "../../src/data/loadCrownlineGeography";
import type { CrownlineBoundariesLoader } from "../../src/data/loadCrownlineBoundaries";
import "../../src/styles/styles.css";

export const sourceData = await loadSourceData();
export const artifacts = buildGeneratedArtifacts(sourceData);

const showModalDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal"
);

/** Installs the shared URL and native-dialog isolation used by App integration suites. */
export function installAppTestLifecycle() {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    if (showModalDescriptor) {
      Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalDescriptor);
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    }
  });
}

export const loadGeneratedDetail = async (entityId: string) =>
  artifacts.details.get(entityId) ?? null;

export const loadGeneratedGeography = async () => ({
  geography: artifacts.geography,
  omittedCount: 0
});

export const loadGeneratedBoundaries = async () => ({
  boundaries: artifacts.boundaries,
  omittedCount: 0
});

export function renderApp(
  loadDetail: (entityId: string) => Promise<CrownlineDetail | null> = loadGeneratedDetail,
  loadGeography: CrownlineGeographyLoader = loadGeneratedGeography,
  loadBoundaries: CrownlineBoundariesLoader = loadGeneratedBoundaries
) {
  return render(
    <App
      data={artifacts.index}
      loadDetail={loadDetail}
      loadGeography={loadGeography}
      loadBoundaries={loadBoundaries}
    />
  );
}

export async function findMapMarker(name: string): Promise<HTMLButtonElement> {
  const map = await screen.findByRole("region", { name: /历史政权(?:总览|示意)地图/ });
  return within(map).getByRole("button", { name });
}

export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
