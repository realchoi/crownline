# Crownline · 王冠纪

> 世界王朝与帝国时间轴——沿时间线探索世界王朝、帝国与文明的兴衰。

Crownline（王冠纪）是一个面向全球历史的交互式王朝图谱项目。当前版本收录中国历代王朝与主要政权；世界其他地区的数据与跨区域浏览能力将在后续版本中逐步加入。

## 当前功能

- 按七个历史阶段展示 73 个中国历代王朝、主要政权与历史分期
- 支持名称、别名、年份和说明搜索，以及展示类别筛选
- 点击时间条查看详情；中断或复立政权可显示多个存在区间
- 搜索与类别状态同步到 URL
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

校验分两层：JSON Schema 负责必填字段、枚举、格式与基本结构；TypeScript 语义校验负责重复 ID、无效或相邻区间、悬空引用、分类矛盾、争议口径缺少说明等跨记录规则。

公元前年份使用负整数，公元后使用正整数，不存在公元 0 年；区间两端均包含。西秦、唐等中断条目使用多个 `existencePeriods`，而不是把中断期误算为连续存续。

## 字体资源

页面字体位于 `src/assets/fonts/`，通过 `@font-face` 从站内加载：

- 正文使用 Noto Sans SC 页面字符子集
- 拉丁标题使用 Source Serif 4
- 中文标题使用 Noto Serif SC

字体均为 WOFF2，并附 SIL Open Font License 1.1。新增页面文案、名称或语言时，需要检查并重新生成相应字符子集，避免新字符回退到设备字体。

## 部署到 GitHub Pages

先执行生产构建，再将 `dist/` 作为 Pages 站点内容发布。`vite.config.ts` 使用相对资源基路径，可适配 `https://<username>.github.io/crownline/` 这类项目子路径。

推荐使用 GitHub Actions 执行 `npm ci && npm run build`，并上传 `dist/` 作为 Pages artifact；不要再把仓库根目录当作可直接发布的静态站点。

## 发展路线

长远规划见 [ROADMAP.md](ROADMAP.md)。阶段 0.5 已建立稳定 ID、多段存在区间、年代口径、地区职责、人物/任期/关系/事件/来源模型与自动校验。下一阶段将实现全局年份状态和“当时存在”的时间点浏览。

## 数据口径

“王朝”与“政权”的边界因地区和史学传统而异。项目当前采用通史中常见的中国历史口径，重点展示主线王朝和主要并立政权，不声称囊括所有地方割据、短暂称帝政权或边疆政权。扩展到世界历史时，将保留各地区自身的历史称谓，并明确说明分类与年代依据。

## 贡献

欢迎通过 Issue 提交数据纠错、可靠资料来源、功能建议或无障碍问题。涉及年代、名称和政权关系的修改，请尽量附上可核查来源。

## 许可证

项目代码以 [MIT License](LICENSE) 发布。历史事实本身不受版权保护；项目中的文字、设计和代码按许可证使用。
