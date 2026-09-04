# Crownline Agent Guide

本文件适用于整个仓库。后续 AI agent 在修改代码、数据、样式、测试或文档前，应先阅读本文件；若更深层目录以后增加了自己的 `AGENTS.md`，则以距离目标文件最近的说明为补充或覆盖。

## 项目目标与原则

Crownline（王冠纪）是一个中文优先、纯静态部署的世界历史政权时间轴与地图应用。当前技术栈是 React 19、Vite 8、TypeScript 7、JSON Schema/Ajv、Vitest/Testing Library 和 Playwright/axe-core。

这个项目不仅要求“能显示”，还要求历史口径可追溯、未知信息不被误写成否定事实、浏览状态可分享、异步失败可恢复，并在桌面端、移动端和键盘/辅助技术下都可使用。

开始工作前：

- 先查看 `git status --short`，保留用户已有改动，不覆盖、不清理无关文件。
- 阅读将要修改的模块及其相邻测试；涉及历史数据时同时阅读 `docs/data-contract.md`。
- 优先做局部、可验证的修改，不顺手重构无关区域，也不要无请求地新增依赖或更换构建工具。
- 用户可见文案以简体中文为主；代码标识符使用英文，复杂历史或状态语义可写简短注释。

## 目录与依赖方向

- `src/app/`：页面级组合、共享浏览状态和请求生命周期。`App.tsx` 只负责组合数据、控件、结果、详情与对比；不要把新的领域计算或复杂请求状态重新堆进这里。
- `src/components/`：可复用交互和展示组件。组件保持受控、语义化，并把纯计算留给领域层。
- `src/domain/`：纯类型、纪年运算、筛选、分组、比较、地图选择和完整语义校验。这里的函数应尽量确定、无 DOM/网络副作用、可直接单元测试。
- `src/data/`：运行时 loader、窄校验、生成产物派生和覆盖报告。浏览器边界必须把网络 JSON 当作 `unknown` 后收窄。
- `src/data/source/`：人工维护的权威历史数据源。实体及其人物/任期按实体分片；地区、来源、关系、事件、点位和疆域按职责分片。
- `scripts/`：数据聚合、生成、校验、文档摘要、疆域预算和字体工具。
- `src/styles/`：全局 class 样式。`styles.css` 的导入顺序就是层叠顺序：`base`、`hero`、`controls`、`comparison`、`timeline`、`footer`、`detail`、`map`、`responsive`；不要随意改序。
- `tests/`：领域、数据与组件测试；`tests/app/` 是应用集成测试；`tests/helpers/renderApp.tsx` 提供真实生成数据、loader、deferred promise 和清理工具。
- `e2e/`：Playwright 桌面/移动浏览器冒烟、响应式与无障碍测试。
- `docs/`：数据契约、历史口径审查和设计记录。`README.md` 是当前行为与维护入口，`ROADMAP.md` 是路线与历史进展。

依赖方向通常应为 `app/components -> domain + data`，`data -> domain`。不要让领域层依赖 React、DOM 或网络。

## 数据源与生成物

权威数据只能修改 `src/data/source/`。以下目录是可重建产物，禁止手工编辑或提交：

- `.generated/`
- `public/data/generated/`
- `dist/`
- `coverage/`
- `playwright-report/`
- `test-results/`

`npm run generate:data` 会聚合源分片、执行完整校验，并原子替换工具产物和浏览器产物。生成过程有锁，允许测试/构建触发并发生成；不要绕开锁直接写产物。

实体分片规则：

- 路径为 `src/data/source/entities/<region>/<entity-id>.json`。
- 文件名必须等于唯一主实体 ID；每个分片必须且只能包含一个主实体。
- `order` 是全局唯一正整数，决定稳定聚合顺序。现有值通常以 10 为间隔，插入时优先使用空位。
- 所有顶层记录共享全局 ASCII kebab-case ID 命名空间；引用使用稳定 ID，不能依赖显示名称、文件顺序或数组下标。
- 生成结果和覆盖报告必须保持确定性；新增集合处理时显式稳定排序，不能依赖输入偶然顺序。

数据规模变化后，同步更新 `README.md`、`docs/data-contract.md`、`ROADMAP.md` 中的 `crownline-data-stats` 标记区块，再运行 `npm run check:docs`。不要改写路线图里的历史进展数字。

## 不可破坏的历史语义

机器契约以 `src/data/crownline-data.schema.json` 为准，TypeScript 形状以 `src/domain/types.ts` 为准，人类可读规则以 `docs/data-contract.md` 为准。

- 历史年份使用非零整数：负数为公元前，正数为公元后，不存在公元 0 年。区间两端均包含。
- 不要直接用 `year + 1`、普通减法或普通跨度处理跨纪元逻辑；复用 `src/domain/chronology.ts` 的 ordinal、步进、格式化和区间函数。
- 多段存续必须使用多个按时间升序、互不重叠且不相邻的 `existencePeriods`；不能把中断期合并成连续存在。
- `entityKind` 表示真实政权或历史分期；`displayCategory` 只表示 UI 层级，二者不能混用。历史分期不得被当作政权、统治者主体、地图点位或对比对象。
- `historicalRegionIds`、`culturalSphereIds`、`modernAreaIds` 含义不同。地区筛选只基于历史地区，父地区包含后代，多选采用并集且实体不重复。
- 地区 `coverage` 只描述当前数据集，永远不能用“未收录”推断“历史上不存在”。项目刻意没有“完整覆盖”状态。
- 没有任期记录表示“资料尚未校订”，不是空位；只有有来源的 `reignVacancies` 才能显示明确空位。
- 没有结构化关系表示“暂无已校订关系数据”，不是双方没有历史关系。时间重叠本身也不能推出战争、外交、臣属或其他关系。
- 朝贡不自动等于政治臣属；贸易或文化相似不自动等于政府条约、中央经营或主权关系。关系和事件必须由来源直接支持参与方、类型与时间口径。
- 点位只表示都城、政治中心或浏览定位，不代表疆域、控制强度、现代主权或空间关系。
- 疆域只是在明确适用年份内的简化/重建示意。全时期模式不得叠加跨时代疆域；视觉相交不得触发接壤、重叠、面积、战争、领土或主权推断。
- `local` 与 `localLanguageTag` 必须成对出现，语言标签必须可安全用于 HTML `lang`；原名展示保留 `dir="auto"`。无法可靠恢复历史自称时保持缺省，不补造现代名称或推测转写。
- `low` 或 `disputed` 可信度必须提供解释；争议年代必须披露采用口径。不要为了提高覆盖率而虚构人物、任期、点位或关系。
- 业务记录必须引用已登记来源。新增关系、事件、地理和疆域数据时提供能直接支持口径的来源及尽可能精确的 `locator`；网络来源按契约维护 URL/访问日期。

## 契约变更

新增或修改 UI 必需字段时，至少检查并同步以下四层：

1. `src/data/crownline-data.schema.json`：完整结构、必填字段、封闭对象、枚举与基本格式。
2. `src/domain/types.ts`：消费端静态类型及 `CROWNLINE_SCHEMA_VERSION`。
3. `src/domain/dataValidation.ts`：跨记录引用、区间、分类、来源和业务语义。
4. `src/data/runtimeValidation.ts`：浏览器实际读取字段的最窄安全校验，以及对应 index/detail/geography/boundaries 边界。

然后更新生成器/产物派生、契约测试和文档。Schema 版本变化必须让 Schema、TypeScript 常量、全部生成产物及运行时支持版本同时升级。

运行时容错不能代替构建期正确性：完整源数据必须严格失败；部署后的关系、事件、点位和疆域允许逐条隔离坏记录，是为了保住其余 UI，而不是允许提交坏数据。

## React、状态与异步约定

- 使用严格 TypeScript，特别注意 `noUncheckedIndexedAccess` 和 `exactOptionalPropertyTypes`。缺省可选 prop 时优先不传该属性，不要随意传 `undefined`。
- 沿用函数组件、named exports、`import type` 和现有 2 空格/双引号/分号格式；由 Prettier 决定最终排版。
- 浏览状态的权威模型在 `src/domain/browseState.ts`，URL 生命周期在 `useBrowseUrlState.ts`。新增可分享状态时同时实现读取、清洗、默认值省略、稳定序列化、刷新恢复和后退/前进测试。
- 写 URL 时保留未知查询参数。当前语义是详情开关使用 `pushState`，普通筛选/呈现变化使用 `replaceState`；不要无意改变浏览历史行为。
- “清除筛选”只清搜索和类别，不应重置年份、地区、视图、详情或对比等探索上下文，除非需求明确改变此语义。
- 详情、地理和疆域均按需加载。保持并发请求合并、成功缓存、失败可重试，并用请求序列或等价机制阻止关闭、切换视图/图层或换实体后的迟到响应污染 UI。
- 首屏索引保持轻量；人物、任期、关系、事件、来源、点位和疆域继续留在各自延迟加载包中，不要为方便把完整数据塞回首屏。
- 纯筛选、排序、区间、地图选择和对比逻辑放入 `src/domain/`，并对输入顺序不变性和边界年份写测试。

## UI、样式与无障碍

- 优先使用原生语义元素、真实 `button` 和原生 `dialog`。所有图标式按钮必须有清楚的可访问名称；切换按钮维护 `aria-pressed`，展开项维护 `aria-expanded`/`aria-controls`。
- 模态框、移动筛选抽屉和地图聚合面板必须支持 Escape、打开后合理聚焦、关闭后恢复触发元素焦点。
- 地图视觉交互必须有下方等价结果列表；不能只让鼠标用户点击 SVG/标记。疆域 SVG 不是键盘核心入口。
- 保留 skip link、状态/错误的 `role="status"` 或 `role="alert"`、动态结果的可访问播报，以及本地名称的正确语言和文字方向。
- UI 修改要检查窄屏、桌面、深色模式、减少动态效果和无横向溢出。不要删除 `prefers-reduced-motion` 支持。
- 样式继续使用现有 CSS 变量和分层文件。通用 token 放 `base.css`，功能样式放对应文件，断点覆盖放 `responsive.css`；避免内联视觉常量，动态位置/宽度除外。
- 新增或修改中文文案、实体名、人物名、阶段名或地区名后运行字体覆盖检查。不要手工编辑 WOFF2；检查失败时用字体脚本重建。

## 测试约定

- 领域纯函数：在 `tests/<domain>.test.ts` 增加精确边界用例，尤其覆盖公元前/后、闭区间、多段存在、稳定排序和无记录语义。
- React 组件/应用：使用 Testing Library 按 role、name、label 查询，优先验证用户可观察行为，不绑定实现细节。应用级测试复用 `tests/helpers/renderApp.tsx` 和 `installAppTestLifecycle()`。
- 异步 loader/hook：覆盖 loading、成功、失败重试、缓存/并发合并和迟到结果隔离。
- URL 状态：覆盖非法值清洗、默认值省略、未知参数保留、深链接、刷新与 `popstate`。
- 地图和响应式交互：必要时补 Playwright，保持桌面 Chromium 与 Pixel 7 项目通过，并运行 axe 的 serious/critical 检查。
- 修复 bug 时先添加能复现问题的回归测试；数据批次应测试契约与关键不变量，不要只锁定无意义的整份快照。

常用命令：

```bash
npm run dev
npm test -- tests/<target>.test.ts
npm run typecheck
npm run lint
npm run format:check
npm run validate:data
npm run generate:data
npm run check:docs
npm run check:boundaries
npm run check:fonts
npm run build
npm run test:e2e
npm run check
```

验证应与改动风险匹配：

- 仅文档：对目标文件运行 Prettier 检查；若改了数据摘要，另跑 `npm run check:docs`。
- 领域/组件代码：目标 Vitest + `typecheck` + `lint` + 格式检查；影响跨模块行为时再跑完整 `npm test`。
- 历史数据：至少 `npm run validate:data`、`npm run generate:data` 和相关测试；涉及统计时加 `check:docs`，涉及疆域时加 `check:boundaries`。
- 文案或历史名称：加 `npm run check:fonts`。首次运行会在 `.venv-fonts/` 建本地环境；只有检查失败且确需重建时才运行 `npm run regen:fonts`，该命令会联网下载上游字体。
- UI/交互/响应式/无障碍：目标集成测试 + `npm run test:e2e`；交付前尽量运行 `npm run check`。

`dev`、`test`、`build` 和字体命令都有数据生成前置步骤。不要因看到生成目录变化就编辑生成文件；回到源分片或生成代码修复。

CI 在 Node 24 上执行 `npm ci`、安装 Chromium，然后运行统一的 `npm run check`。本地开发至少使用 README 指定的 Node 版本，并保持 `package-lock.json` 与 `package.json` 一致。

## 完成标准

提交结果前确认：改动位于正确层；没有手改生成物；历史表述没有越过证据边界；URL、异步、键盘和移动端语义未回归；相关测试和校验已经运行。最终回复应简要说明修改了什么、验证了什么，以及任何未运行检查或剩余风险。
