# 双政权时间对比实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可从时间轴或时间点选择两个政权、计算多段时间交集、查看共同期统治者并通过 URL 分享的阶段 4A 能力。

**Architecture:** 将时间算法与统治者过滤放入纯领域模块，将 URL 选择放入现有浏览状态，将加载与展示封装为独立对比面板。时间轴和时间点只注入选择状态及回调，根应用负责组合状态，不复制领域计算。

**Tech Stack:** React 19、TypeScript 7、Vitest、Testing Library、现有 JSON 分片与详情懒加载器。

## Global Constraints

- 对比对象仅允许 `entityKind: "polity"`，最多两个，顺序保留。
- 历史区间为闭区间，不存在公元 0 年。
- 不修改 schema、数据契约、历史数据、依赖或 CI。
- 不展示或推断阶段 4B 的结构化历史关系。
- 所有行为变更必须遵循 RED → GREEN → REFACTOR。
- 按用户 2026-08-12 的最新指示，不安装新依赖，不执行 TypeScript 静态检查；生产构建直接调用本地 Vite。

---

### Task 1: 多段时间交集与共同期统治者

**Files:**
- Create: `src/domain/polityComparison.ts`
- Create: `tests/polity-comparison.test.ts`

**Interfaces:**
- Produces: `intersectHistoricalPeriods(left, right): HistoricalInterval[]`
- Produces: `buildPolityComparison(left, right): PolityComparison`
- Produces: `selectRulersDuringPeriods(polity, detail, periods): ComparisonRulerEntry[]`

- [x] 写失败测试，使用手工区间验证无交集、单段、多段、端点、跨纪元和保守精度。
- [x] 运行 `npm test -- tests/polity-comparison.test.ts`，确认因接口缺失失败。
- [x] 实现最小交集算法，使用 `toOrdinal` 和 `calculatePeriodsDuration`。
- [x] 重跑定向测试，确认时间算法通过。
- [x] 增加共同期统治者失败测试，验证人物、角色和裁剪后的任期。
- [x] 实现 `selectRulersDuringPeriods`，拒绝详情实体不匹配并稳定排序。
- [x] 重跑定向测试并保持通过。

### Task 2: 对比 URL 状态

**Files:**
- Modify: `src/domain/browseState.ts`
- Modify: `tests/browse-state.test.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- `BrowseState` 新增 `compareEntityIds: string[]`。
- `readBrowseState(search, bounds, regions, entities)` 清洗重复 `compare` 参数。
- `writeBrowseState` 按选择顺序序列化最多两个 `compare` 参数。

- [x] 先扩充 browse-state 测试，断言合法政权保留、历史分期/未知/重复/第三项被清洗。
- [x] 运行 `npm test -- tests/browse-state.test.ts`，确认新断言失败。
- [x] 实现读取和写入，更新所有既有 BrowseState 测试 fixture 的默认空数组。
- [x] 更新 App 初始化调用传入 `data.entities`。
- [x] 重跑 browse-state 与现有 App 测试。

### Task 3: 选择控件与两种浏览视图

**Files:**
- Create: `src/components/ComparisonToggle.tsx`
- Modify: `src/components/TimelineStage.tsx`
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/TimepointView.tsx`
- Modify: `src/app/App.tsx`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- 视图组件接收 `comparisonEntityIds` 与 `onToggleComparison(entityId)`。
- `ComparisonToggle` 使用 `aria-pressed` 表达已选状态，满员时禁用未选政权。

- [x] 先写 App 失败测试：全览加入/移除、时间点加入、历史分期不可选、满两个禁用其他项、URL 同步。
- [x] 运行新增用例并确认因控件不存在失败。
- [x] 实现可复用按钮并接入时间轴行；不改变时间条详情点击。
- [x] 调整时间点卡片为“详情按钮 + 对比按钮”的非嵌套操作组。
- [x] 在 App 中实现最多两个的切换状态更新。
- [x] 重跑 App 定向用例和现有测试。

### Task 4: 对比面板、详情加载与当前年份联动

**Files:**
- Create: `src/components/ComparisonPanel.tsx`
- Modify: `src/app/App.tsx`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- `ComparisonPanel` 消费选中政权、地区、可选当前年份、`CrownlineDetailLoader`、移除和清空回调。
- 面板始终先展示基本时间比较；详情异步补充共同期及当前年统治者。

- [x] 写失败测试：一个槽位提示、两个政权多段交集与年数、清除操作。
- [x] 运行定向用例，确认对比面板尚不存在。
- [x] 实现基础两槽布局和领域摘要，接入 App。
- [x] 写失败测试：共同期统治者、当前年份快照、失败重试、切换后忽略迟到详情。
- [x] 实现并行详情加载、序列保护、重试和统治者区域。
- [x] 重跑 App 测试，保证详情弹窗原行为不回归。

### Task 5: 视觉、响应式与文档收尾

**Files:**
- Modify: `src/styles/styles.css`
- Modify: `README.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- 桌面为两列对比档案，760px 以下单列。
- 对比选择、禁用、当前年命中、加载和错误状态必须可辨识且保留焦点轮廓。

- [x] 增加对比台、槽位、按钮和双方列样式，复用现有颜色变量与字体。
- [x] 验证 390px、760px、桌面及既有深色 media query 下无页面级溢出。
- [x] 更新 README 当前功能、数据流和 URL 状态说明。
- [x] 勾选 ROADMAP 阶段 4A 四项并写入实际完成记录。
- [x] 运行 `npm run check:fonts`；现有字体子集覆盖全部新增用字。

### Task 6: Review 与完成验证

**Files:**
- Review all task-related changes

**Interfaces:**
- Produces: 可追溯的质量证据和干净的任务差异。

- [x] 对照设计验收逐项自审，检查历史分期、无交集、多段交集、错误与迟到请求边界。
- [x] 运行 `npm run validate:data`。
- [x] 运行 `npm test` 并确认全部测试通过。
- [x] 按用户最新指示跳过 `npm run typecheck`。
- [x] 运行 `./node_modules/.bin/vite build`，绕过静态检查完成生产打包验证。
- [x] 运行 `npm run check:fonts`。
- [x] 运行 `git diff --check`、`git status --short`，确认无生成产物和无关改动。
