import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntityLocalName } from "../src/components/EntityLocalName";

describe("实体本地名称组件", () => {
  it("使用合法语言标签、自动文字方向与行内容元素", () => {
    render(
      <button type="button">
        <EntityLocalName
          names={{
            primary: "阿拔斯哈里发",
            aliases: [],
            local: "الخلافة العباسية",
            localLanguageTag: "ar"
          }}
        />
      </button>
    );

    const localName = screen.getByText("الخلافة العباسية");
    expect(localName.tagName).toBe("SPAN");
    expect(localName).toHaveAttribute("lang", "ar");
    expect(localName).toHaveAttribute("dir", "auto");
  });

  it("没有本地名称时不渲染占位内容", () => {
    const { container } = render(<EntityLocalName names={{ primary: "唐", aliases: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
