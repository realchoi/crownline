# 检查字体子集是否覆盖全站实际用字。
# 用法: python3 scripts/check-font-subset.py   (依赖: pip install fonttools brotli)
# 任何已渲染字符缺失时退出码为 1 并列出缺失字符；需要重新生成子集。
import json
import sys
from collections import defaultdict
from pathlib import Path

from font_charsets import ASCII, DATA_EXCLUDED_KEYS, collect_display_chars, strip_comments

try:
    from fontTools.ttLib import TTFont
except ImportError:
    print("缺少 fonttools/brotli；请改用 npm run check:fonts，它会自动准备本地虚拟环境。")
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "src/assets/fonts"

def cmap_chars(path: Path) -> set[int]:
    font = TTFont(path)
    chars: set[int] = set()
    for table in font["cmap"].tables:
        if table.isUnicode():
            chars.update(table.cmap.keys())
    font.close()
    return chars


def collect_usage() -> tuple[dict[str, set[str]], dict]:
    """收集源码与数据中的非 ASCII 字符及其出处。"""
    usage: dict[str, set[str]] = defaultdict(set)
    for path in list((ROOT / "src").rglob("*.ts")) + list((ROOT / "src").rglob("*.tsx")):
        for ch in strip_comments(path.read_text(encoding="utf-8")):
            if ch.strip() and ord(ch) > 127:
                usage[ch].add(f"src/{path.name}")
    for ch in (ROOT / "index.html").read_text(encoding="utf-8"):
        if ch.strip() and ord(ch) > 127:
            usage[ch].add("index.html")

    data = json.loads((ROOT / "src/data/crownline-data.json").read_text(encoding="utf-8"))

    def walk(node, trail: str):
        if isinstance(node, str):
            for ch in node:
                if ch.strip() and ord(ch) > 127:
                    usage[ch].add(f"data:{trail}")
        elif isinstance(node, dict):
            for key, value in node.items():
                if key not in DATA_EXCLUDED_KEYS:
                    walk(value, f"{trail}.{key}")
        elif isinstance(node, list):
            for item in node:
                walk(item, trail)

    walk(data, "")
    return usage, data


def main() -> int:
    sans = cmap_chars(FONTS / "noto-sans-sc-page-400-700.woff2")
    song = cmap_chars(FONTS / "noto-serif-sc-display-700.woff2")
    latin = cmap_chars(FONTS / "source-serif-4-latin-var.woff2")
    usage, data = collect_usage()

    problems: list[str] = []
    for ch in sorted(usage, key=ord):
        if ord(ch) not in sans:
            problems.append(f"正文子集缺失 U+{ord(ch):04X} {ch} ← {sorted(usage[ch])[:3]}")
    display_cover = song | latin
    # 与生成脚本共享标题字符集，检查结果即代表下一次生成所采用的规则。
    for ch in sorted(collect_display_chars(data), key=ord):
        if ord(ch) not in display_cover:
            problems.append(f"标题子集缺失 U+{ord(ch):04X} {ch}")
    for ch in "0123456789":
        if ord(ch) not in latin:
            problems.append(f"拉丁衬线子集缺失数字 {ch}(当前年份等标题数字会用系统字体渲染)")
    for ch in ASCII - {" "}:
        if ord(ch) not in sans:
            problems.append(f"正文子集缺失 ASCII {ch!r}")

    if problems:
        print(f"字体子集覆盖检查失败,共 {len(problems)} 处缺失:")
        print("\n".join(problems[:60]))
        if len(problems) > 60:
            print(f"... 以及另外 {len(problems) - 60} 处")
        print("请按 README「字体资源」一节重新生成字符子集。")
        return 1
    print(f"字体子集覆盖检查通过:正文 {len(sans)} 字符,标题 {len(song)} 字符,拉丁 {len(latin)} 字符,全站用字均已覆盖。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
