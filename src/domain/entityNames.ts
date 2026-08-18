import type { LocalizedNames } from "./types";

const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/** 验证可供 HTML lang 使用的已注册 BCP 47 语言标签。 */
export function isValidLanguageTag(value: unknown): value is string {
  if (typeof value !== "string" || !LANGUAGE_TAG_PATTERN.test(value)) return false;
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

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
