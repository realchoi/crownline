# 重新生成 src/assets/fonts/ 下的三个 WOFF2 字符子集。
# 用法: python3 scripts/regen-font-subsets.py   (依赖: pip install fonttools brotli)
#
# 全量字体来自 google/fonts 仓库(OFL 许可),脚本会自动下载到临时目录:
#   - NotoSansSC[wght].ttf        正文(保留可变字重 100-900)
#   - NotoSerifSC[wght].ttf       中文标题(实例化 wght=700 静态字体)
#   - SourceSerif4[opsz,wght].ttf 拉丁标题(保留两个可变轴)
# 字符集由全站源码文案与 crownline-data.json 的实际用字生成,
# 与 scripts/check-font-subset.py 的口径一致。
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
except ImportError:
    print("缺少 fonttools/brotli；请改用 npm run regen:fonts，它会自动准备本地虚拟环境。")
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/assets/fonts"
PYFTSUBSET = sys.executable

SOURCES = {
    "NotoSansSC.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    "NotoSerifSC.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
    "SourceSerif4.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf",
}

ASCII = {chr(c) for c in range(0x20, 0x7F)}


def strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r'(?<!["\':])//.*', "", text)


def collect_charsets(data: dict) -> tuple[set[str], set[str], set[str]]:
    source_chars: set[str] = set()
    for path in list((ROOT / "src").rglob("*.ts")) + list((ROOT / "src").rglob("*.tsx")):
        source_chars |= {c for c in strip_comments(path.read_text(encoding="utf-8")) if c.strip()}
    source_chars |= {c for c in (ROOT / "index.html").read_text(encoding="utf-8") if c.strip()}

    data_chars: set[str] = set()

    def walk(node):
        if isinstance(node, str):
            data_chars.update(c for c in node if c.strip())
        elif isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    sans = source_chars | data_chars | ASCII

    song = set("跨地区政权世界王朝与帝国时间轴王冠纪当时存在的政权历史背景年约前（）")
    song |= {c for e in data["entities"] for c in e["names"]["primary"]}
    song |= {c for s in data["timelineSections"] for c in s["title"]}
    song |= {c for r in data["regions"] for c in r["names"]["primary"]}
    song -= {"·"}  # 间隔号由拉丁衬线承担

    return sans, song, ASCII | {"·", "–", "—"}


def subset(src: Path, chars: set[str], out: Path, workdir: Path):
    charset_file = workdir / f"{out.stem}.txt"
    charset_file.write_text("".join(sorted(chars)), encoding="utf-8")
    subprocess.run(
        [PYFTSUBSET, "-m", "fontTools.subset", str(src),
         f"--text-file={charset_file}", "--flavor=woff2", f"--output-file={out}"],
        check=True,
    )
    print(f"生成 {out.relative_to(ROOT)}: {len(chars)} 字符, {out.stat().st_size} bytes")


def main() -> int:
    data = json.loads((ROOT / "src/data/crownline-data.json").read_text(encoding="utf-8"))
    sans_chars, song_chars, latin_chars = collect_charsets(data)

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for name, url in SOURCES.items():
            target = tmpdir / name
            print(f"下载 {name} ...")
            urllib.request.urlretrieve(url, target)

        serif_static = TTFont(tmpdir / "NotoSerifSC.ttf")
        instantiateVariableFont(serif_static, {"wght": 700}, inplace=True)
        serif_static_path = tmpdir / "NotoSerifSC-700.ttf"
        serif_static.save(serif_static_path)
        serif_static.close()

        subset(tmpdir / "NotoSansSC.ttf", sans_chars, OUT / "noto-sans-sc-page-400-700.woff2", tmpdir)
        subset(serif_static_path, song_chars, OUT / "noto-serif-sc-display-700.woff2", tmpdir)
        subset(tmpdir / "SourceSerif4.ttf", latin_chars, OUT / "source-serif-4-latin-var.woff2", tmpdir)

    print("完成。请运行 npm run check:fonts 复核覆盖情况。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
