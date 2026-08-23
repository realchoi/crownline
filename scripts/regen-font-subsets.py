# 重新生成 src/assets/fonts/ 下的四个 WOFF2 字符子集。
# 用法: python3 scripts/regen-font-subsets.py   (依赖: pip install fonttools brotli)
#
# 全量字体来自 google/fonts 仓库(OFL 许可),脚本会自动下载到临时目录:
#   - NotoSans[wdth,wght].ttf    拉丁正文(保留可变宽度与字重)
#   - NotoSansSC[wght].ttf        正文(保留可变字重 100-900)
#   - NotoSerifSC[wght].ttf       中文标题(实例化 wght=700 静态字体)
#   - SourceSerif4[opsz,wght].ttf 拉丁标题(保留两个可变轴)
# 字符集由全站源码文案与聚合后的完整历史数据实际用字生成,
# 与 scripts/check-font-subset.py 的口径一致。
import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from font_charsets import collect_font_charsets

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
    "NotoSans.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf",
    "NotoSansSC.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    "NotoSerifSC.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
    "SourceSerif4.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf",
}

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
    data = json.loads((ROOT / ".generated/data/crownline-data.json").read_text(encoding="utf-8"))
    # 生成和检查共用同一套字符收集规则，避免新增标题字段时只更新一侧。
    sans_chars, song_chars, latin_chars = collect_font_charsets(ROOT, data)
    # Latin Extended characters used by scholarly transliteration (for example ʿ/ḥ)
    # belong in the Latin body subset rather than falling through to the CJK font.
    latin_body_chars = {char for char in sans_chars if ord(char) < 0x0300}

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

        subset(tmpdir / "NotoSans.ttf", latin_body_chars, OUT / "noto-sans-latin-page-var.woff2", tmpdir)
        subset(tmpdir / "NotoSansSC.ttf", sans_chars, OUT / "noto-sans-sc-page-400-700.woff2", tmpdir)
        subset(serif_static_path, song_chars, OUT / "noto-serif-sc-display-700.woff2", tmpdir)
        subset(tmpdir / "SourceSerif4.ttf", latin_chars, OUT / "source-serif-4-latin-var.woff2", tmpdir)

    print("完成。请运行 npm run check:fonts 复核覆盖情况。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
