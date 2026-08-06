import dataJson from "./crownline-data.json";
import { validateCrownlineData } from "../domain/dataValidation";
import type { CrownlineData } from "../domain/types";

/**
 * 加载并校验内置历史数据。
 * 只有结构校验和跨记录语义校验都通过后，才向应用返回强类型数据。
 */
export function loadCrownlineData(): CrownlineData {
  const result = validateCrownlineData(dataJson);
  if (!result.valid) {
    const details = result.issues
      .map((issue) => `[${issue.code}] ${issue.path} ${issue.message}`)
      .join("\n");
    throw new Error(`历史数据校验失败：\n${details}`);
  }
  return dataJson as unknown as CrownlineData;
}
