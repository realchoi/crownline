import { fireEvent, render, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach } from "vitest";

import { loadSourceData } from "../../scripts/data-source";
import { App } from "../../src/app/App";
import { buildGeneratedArtifacts } from "../../src/data/artifacts";
import type { CrownlineDetail } from "../../src/domain/types";
import type { CrownlineGeographyLoader } from "../../src/data/loadCrownlineGeography";
import type { CrownlineBoundariesLoader } from "../../src/data/loadCrownlineBoundaries";
import { createBoundaryFixture } from "./boundaryFixtures";
import "../../src/styles/styles.css";

export const sourceData = await loadSourceData();
export const artifacts = buildGeneratedArtifacts(sourceData);
export const boundaryFixtureIndex = {
  ...artifacts.index,
  boundarySnapshotCount: createBoundaryFixture().boundarySnapshots.length
};

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
  loadBoundaries: CrownlineBoundariesLoader = loadGeneratedBoundaries,
  data = artifacts.index
) {
  return render(
    <App
      data={data}
      loadDetail={loadDetail}
      loadGeography={loadGeography}
      loadBoundaries={loadBoundaries}
    />
  );
}

/** 桌面工具条把类别、精确跳转、地区多选与地图图层收在“更多筛选”中；已展开时不重复点击。 */
export function openMoreFilters() {
  const toggle = screen.getByRole("button", { name: /更多筛选/ });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
}

/** 唯一的时间范围控件；紧凑条或抽屉另有副本时传入所在容器。 */
export function getTimeRangeControl(container: HTMLElement = document.body) {
  return within(container).getAllByRole("region", { name: "时间范围" })[0]!;
}

/** 在年份框输入年份并提交，进入指定年份；纪元不同时再切换纪元（改纪元立即生效）。 */
export async function enterYear(user: UserEvent, year: number, container?: HTMLElement) {
  const control = within(getTimeRangeControl(container));
  const input = control.getByRole("textbox", { name: "年份" });
  await user.clear(input);
  await user.type(input, `${Math.abs(year)}{Enter}`);
  const era = year < 0 ? "bce" : "ce";
  const eraSelect = control.getByRole("combobox", { name: "纪元" });
  if ((eraSelect as HTMLSelectElement).value !== era) await user.selectOptions(eraSelect, era);
}

/** 当前年份框的值；全时期时为空。 */
export function getYearInput(container?: HTMLElement) {
  return within(getTimeRangeControl(container)).getByRole("textbox", { name: "年份" });
}

/** 在东亚视野中查找中国点位的单点标记；全球视野下相邻都城会按屏幕距离聚合。 */
export async function findMapMarker(name: string): Promise<HTMLButtonElement> {
  const map = await screen.findByRole("region", { name: /历史政权(?:总览|示意)地图/ });
  const eastAsia = within(map).getByRole("button", { name: "东亚" });
  if (eastAsia.getAttribute("aria-pressed") !== "true") fireEvent.click(eastAsia);
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
