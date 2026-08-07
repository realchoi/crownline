#!/usr/bin/env bash
# 在项目本地虚拟环境 .venv-fonts/ 中运行字体脚本；首次运行时自动创建环境并安装依赖，
# 避免向系统 Python 直接 pip install（macOS 的 PEP 668 保护会拒绝）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/.venv-fonts"

if [ ! -x "$VENV/bin/python3" ]; then
  echo "首次运行字体工具：正在创建本地虚拟环境 .venv-fonts/ 并安装 fonttools、brotli ..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet fonttools brotli
fi

exec "$VENV/bin/python3" "$@"
