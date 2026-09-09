import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

function inspectFixtureCharacters() {
  const script = String.raw`
import json
from tempfile import TemporaryDirectory
from pathlib import Path
from scripts.font_charsets import collect_font_charsets

fixture = {
    "entities": [],
    "persons": [],
    "timelineSections": [],
    "regions": [],
    "sources": [{"title": "ประวัติ 왕의 Café：王表"}],
}
with TemporaryDirectory() as directory:
    root = Path(directory)
    (root / "src").mkdir()
    (root / "index.html").write_text("", encoding="utf-8")
    sans, _, latin = collect_font_charsets(root, fixture)
print(json.dumps({
    "thai": "ป" in sans,
    "thai_combining": "ั" in sans,
    "hangul": "왕" in sans,
    "latin_extended": "é" in sans,
    "cjk": "王" in sans,
    "punctuation": "：" in sans,
    "ascii_body": "A" in sans,
    "ascii_title": "A" in latin,
}))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", script], {
      cwd: process.cwd(),
      encoding: "utf8"
    })
  ) as Record<string, boolean>;
}

describe("字体字符集系统回退边界", () => {
  it("排除泰文与韩文，同时继续收集中文、拉丁和通用标点", () => {
    expect(inspectFixtureCharacters()).toEqual({
      thai: false,
      thai_combining: false,
      hangul: false,
      latin_extended: true,
      cjk: true,
      punctuation: true,
      ascii_body: true,
      ascii_title: true
    });
  });
});
