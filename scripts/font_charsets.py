"""字体子集生成与覆盖检查共用的字符集规则。"""

import re
from pathlib import Path


ASCII = {chr(codepoint) for codepoint in range(0x20, 0x7F)}
DATA_EXCLUDED_KEYS = {"local"}


def strip_comments(text: str) -> str:
    """移除源码注释，避免为不会渲染的注释文字扩大字体。"""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r'(?<!["\':])//.*', "", text)


def collect_source_chars(root: Path) -> set[str]:
    """收集 TypeScript、TSX 与入口 HTML 中实际可渲染的非空白字符。"""
    chars: set[str] = set()
    source_paths = list((root / "src").rglob("*.ts")) + list((root / "src").rglob("*.tsx"))
    for path in source_paths:
        chars.update(char for char in strip_comments(path.read_text(encoding="utf-8")) if char.strip())
    chars.update(char for char in (root / "index.html").read_text(encoding="utf-8") if char.strip())
    return chars


def collect_data_chars(data: dict) -> set[str]:
    """收集 JSON 中会被当前界面渲染的字符，排除尚未展示的外文原名。"""
    chars: set[str] = set()

    def walk(node):
        if isinstance(node, str):
            chars.update(char for char in node if char.strip())
        elif isinstance(node, dict):
            for key, value in node.items():
                if key not in DATA_EXCLUDED_KEYS:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    return chars


def collect_display_chars(root: Path, data: dict) -> set[str]:
    """收集标题可能使用的源码静态文案与动态名称。

    源码静态文案采用非 ASCII 超集，避免新增标题组件后还要同步维护手工字符清单；
    页面标题动态值仍按实际使用的数据字段收集，避免把全部历史描述装入标题字体。
    """
    static_chars = {char for char in collect_source_chars(root) if ord(char) > 127}
    strings = [entity["names"]["primary"] for entity in data["entities"]]
    strings += [person["names"]["primary"] for person in data["persons"]]
    strings += [section["title"] for section in data["timelineSections"]]
    strings += [region["names"]["primary"] for region in data["regions"]]
    dynamic_chars = {char for string in strings for char in string if char.strip()}
    return (static_chars | dynamic_chars) - {"·"}


def collect_font_charsets(root: Path, data: dict) -> tuple[set[str], set[str], set[str]]:
    """返回正文、中文标题与拉丁标题字体的统一生成字符集。"""
    sans = collect_source_chars(root) | collect_data_chars(data) | ASCII
    song = collect_display_chars(root, data)
    latin = ASCII | {"·", "–", "—"}
    return sans, song, latin
