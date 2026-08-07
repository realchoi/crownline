# Crownline · 王冠纪

> 世界王朝与帝国时间轴——沿时间线探索世界王朝、帝国与文明的兴衰。

Crownline（王冠纪）是一个面向全球历史的交互式王朝图谱项目。当前版本以中国历代王朝与主要政权为完整基线，并用少量外部代表条目验证跨地区时间点与完整全览浏览；世界其他地区仍会在后续版本中逐步补全。

## 当前功能

- 中国全览按七个历史阶段展示 73 个历代王朝、主要政权与历史分期
- 自选地区与全球已收录全览使用当前可见结果的统一时间比例，跨地区政权单独分组且只显示一次
- 支持全览与时间点两种模式，可站在指定历史年份查看当时存在的政权
- 全览与时间点模式均可切换中国、自选多个地区与全球已收录，共享地区选择并同步到 URL
- 以拜占庭、阿拔斯、神圣罗马和朱罗四个外部代表条目验证跨地区与多地区归属
- 明确区分尚未收录、覆盖有限和被搜索或类别筛选为空
- 支持传统纪年输入、逐年增减和连续滑杆，跨公元前后时自动跳过公元 0 年
- 时间点结果将真实政权与历史分期背景分开，并提示约年、争议与端点口径
- 16 个中国主线政权已接入统治者任期；时间点详情可显示在位、共治、摄政、争位、明确空位与资料缺口
- 支持名称、别名、年份和说明搜索，以及展示类别筛选
- 点击时间条查看存在区间、政权形态、地区、校订说明、统治者与可追溯来源；中断或复立政权可显示多个存在区间
- 浏览模式、当前年份、地区、搜索与类别状态同步到 URL
- 自动适配手机、桌面和系统深色模式
- 使用 JSON Schema、TypeScript 类型和语义校验共同保护历史数据

## 技术栈

- React 19：组件和交互状态
- Vite 8：开发服务器与生产构建
- TypeScript 7：应用代码、数据类型与命令行类型检查
- JSON Schema 2020-12 + Ajv：运行时结构校验
- Vitest + Testing Library：数据规则与界面回归测试

项目使用 TypeScript 7 的 `tsc` 命令行能力，不依赖 TypeScript 旧版的可编程编译器 API。

## 项目结构

```text
.
├── index.html
├── src/
│   ├── app/                  # React 应用状态与页面组合
│   ├── components/           # 筛选、时间轴与详情组件
│   ├── data/
│   │   ├── crownline-data.json
│   │   └── crownline-data.schema.json
│   ├── domain/               # 类型、纪年运算、选择器与数据校验
│   ├── assets/               # 字体资源
│   └── styles/               # 页面样式
├── scripts/validate-data.ts  # 独立数据校验入口
├── tests/                    # 单元与界面回归测试
├── docs/                     # 数据契约与实施设计
├── package.json
├── tsconfig.json
├── vite.config.ts
├── ROADMAP.md
└── LICENSE
```

## 本地开发

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

按终端给出的地址访问页面。迁移到 Vite 后不再支持直接用 `file://` 打开 `index.html`。

常用质量命令：

```bash
npm run validate:data
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` 的生产文件输出到 `dist/`。

## 数据维护

历史数据以纯 JSON 存放在 `src/data/crownline-data.json`，机器契约位于 `src/data/crownline-data.schema.json`，TypeScript 领域类型位于 `src/domain/types.ts`。完整的人类可读规则见 [数据契约说明](docs/data-contract.md)。

修改数据后至少运行：

```bash
npm run validate:data
npm test
```

校验分两层：JSON Schema 负责必填字段、枚举、格式与基本结构；TypeScript 语义校验负责重复 ID、无效或相邻区间、悬空引用、分类矛盾、任期与空位边界、争议口径缺少说明等跨记录规则。

公元前年份使用负整数，公元后使用正整数，不存在公元 0 年；区间两端均包含。西秦、唐等中断条目使用多个 `existencePeriods`，而不是把中断期误算为连续存续。

地区覆盖状态描述的是当前数据集，不是历史事实的完整程度。“全球已收录”只展示当前已有条目；外部地区目前仍是阶段 2 的少量机制验证样本。

统治者数据当前覆盖全部 16 个中国主线政权；早期王年只录入可明确标注口径的代表记录，缺少任期的年份显示为“资料尚未校订”。只有 `reignVacancies` 中存在有来源记录时才显示“空位”，避免从数据缺口推导历史事实。

## 字体资源

页面字体位于 `src/assets/fonts/`，通过 `@font-face` 从站内加载：

- 正文使用 Noto Sans SC 页面字符子集（可变字重 100–900）
- 拉丁标题使用 Source Serif 4（含数字，可变字重与光学尺寸）
- 中文标题使用 Noto Serif SC（700）

字体均为 WOFF2，并附 SIL Open Font License 1.1。新增页面文案、名称或语言时，需要检查并重新生成相应字符子集，避免新字符回退到设备字体、与相邻文字混排两套字体。修改文案或数据后请运行：

```bash
npm run check:fonts
```

只需系统装有 Python 3：首次运行会自动在项目内创建 `.venv-fonts/` 虚拟环境并安装 fonttools 与 brotli，无需手动 pip。检查失败时运行 `npm run regen:fonts`，以全量字体重新生成三个子集（脚本会自动下载字体源文件）；`names.local` 等外文原名暂未渲染，不在中文字体子集的覆盖范围内。

## 部署到 GitHub Pages

先执行生产构建，再将 `dist/` 作为 Pages 站点内容发布。`vite.config.ts` 使用相对资源基路径，可适配 `https://<username>.github.io/crownline/` 这类项目子路径。

推荐使用 GitHub Actions 执行 `npm ci && npm run build`，并上传 `dist/` 作为 Pages artifact；不要再把仓库根目录当作可直接发布的静态站点。

## 发展路线

长远规划见 [ROADMAP.md](ROADMAP.md)。阶段 3 已完成 16 个中国主线政权的详情与统治者接入；阶段 2B 的中国、自选地区与全球已收录三种范围继续共享全览和时间点状态，多地区全览按地区及跨地区政权分组，并在当前可见结果间使用统一时间比例。

## 数据口径

“王朝”与“政权”的边界因地区和史学传统而异。项目当前采用通史中常见的中国历史口径，重点展示主线王朝和主要并立政权，不声称囊括所有地方割据、短暂称帝政权或边疆政权。扩展到世界历史时，将保留各地区自身的历史称谓，并明确说明分类与年代依据。

## 贡献

欢迎通过 Issue 提交数据纠错、可靠资料来源、功能建议或无障碍问题。涉及年代、名称和政权关系的修改，请尽量附上可核查来源。

## 许可证

项目代码以 [MIT License](LICENSE) 发布。历史事实本身不受版权保护；项目中的文字、设计和代码按许可证使用。
