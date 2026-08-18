import { describe, expect, it } from "vitest";

import {
  formatEntityNameWithLocal,
  getEntityLocalName,
  isValidLanguageTag
} from "../src/domain/entityNames";

describe("实体名称展示", () => {
  it("无本地名称时只返回主名称", () => {
    expect(formatEntityNameWithLocal({ primary: "唐", aliases: [] })).toBe("唐");
    expect(getEntityLocalName({ primary: "唐", aliases: [] })).toBeUndefined();
  });

  it("有本地名称时拼接主名称与本地名称", () => {
    const names = {
      primary: "拜占庭帝国",
      aliases: [],
      local: "Βασιλεία Ῥωμαίων",
      localLanguageTag: "grc"
    };
    expect(formatEntityNameWithLocal(names)).toBe("拜占庭帝国（Βασιλεία Ῥωμαίων）");
    expect(getEntityLocalName(names)).toBe("Βασιλεία Ῥωμαίων");
  });

  it("只接受可供 HTML lang 使用的 BCP 47 标签", () => {
    expect(isValidLanguageTag("grc")).toBe(true);
    expect(isValidLanguageTag("mn-Mong")).toBe(true);
    expect(isValidLanguageTag("auto")).toBe(false);
    expect(isValidLanguageTag("not_a_tag")).toBe(false);
  });
});
