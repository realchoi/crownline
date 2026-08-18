import type { LocalizedNames } from "./types";

/** 单行展示主名称与可选本地名称，用于 aria-label 等场景。 */
export function formatEntityNameWithLocal(names: LocalizedNames): string {
  const local = names.local?.trim();
  return local ? `${names.primary}（${local}）` : names.primary;
}

/** 返回可用于副标题展示的本地名称；空白时返回 undefined。 */
export function getEntityLocalName(names: LocalizedNames): string | undefined {
  const local = names.local?.trim();
  return local || undefined;
}
