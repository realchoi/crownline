# Crownline 数据契约与 React/Vite 迁移设计

## 背景

Crownline 当前以单个 HTML 页面、全局 JavaScript 数据和原生 DOM 操作为基础。阶段 0.5 需要为年份、地区、人物、统治任期、关系、事件、来源和地图建立稳定数据契约；后续阶段还会增加共享年份状态、URL 恢复、双政权对比和地图视图。继续扩展当前嵌套数据和内联脚本会让数据引用、类型约束、测试和组件状态逐步耦合。

本次迁移在阶段 0.5 内完成数据底座和前端工程化升级。采用 React、TypeScript、Vite、JSON Schema 与 Ajv，并保留现有页面的信息架构、视觉样式和 GitHub Pages 静态部署能力。

## 目标

- 将现有 7 个时间轴阶段和 73 个历史条目迁移到规范化、带稳定 ID 的 v1 数据契约。
- 将实体语义、政权形态与展示类别分开。
- 使用多个存在区间表达中断与复立，正确建模西秦和唐。
- 统一公元前后、无公元 0 年、端点包含、年代精度、争议口径和传统显示规则。
- 定义地区、文化圈、现代地理范围、人物、任期、关系、事件、来源和可信度接口。
- 用 JSON Schema 和语义校验同时发现结构错误与跨记录错误。
- 将当前页面迁移到 React 组件，并保持现有搜索、分类、详情、响应式和深色模式体验。
- 建立测试、类型检查、构建和数据校验门禁。

## 非目标

- 本阶段不实现全局年份控件、地区选择器、双政权对比或地图。
- 本阶段不补齐完整人物、统治者、关系、事件或全球历史数据。
- 本阶段不引入 React Router、Redux、Zustand、组件库、CSS-in-JS 或后端服务。
- 本阶段不重做视觉设计。
- 构建后不支持通过 `file://` 直接打开；开发和预览统一通过 Vite HTTP 服务。

## 技术选型

- React 19：承载页面组件和后续共享浏览状态。
- TypeScript 7：使用原生编译器约束应用层、领域模型和计算函数。
- Vite：开发服务器、静态资源处理和生产构建。
- JSON Schema Draft 2020-12：数据文件的可移植运行时契约。
- Ajv 8：执行 JSON Schema 校验并提供字段路径错误。
- Vitest：领域函数、校验器和数据完整性测试。
- Testing Library：验证搜索、分类、详情和多段时间条等用户行为。

不引入仅用于生成 TypeScript 类型或 Schema 的额外工具。v1 阶段由 TypeScript 类型和 JSON Schema 并列维护，并通过契约一致性测试防止关键枚举和必填字段漂移。

TypeScript 7.0 不提供旧版编程 API，但本项目只通过 `tsc` CLI 执行类型检查，Vite 负责转译，不依赖该 API。本阶段不引入 `typescript-eslint` 或其他嵌入 TypeScript 编译器 API 的工具，因此无需并装 TypeScript 6 兼容包。

## 目录设计

```text
.
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── assets/
│   │   └── fonts/
│   ├── app/
│   │   └── App.tsx
│   ├── components/
│   │   ├── DetailDialog.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── Timeline.tsx
│   │   └── TimelineStage.tsx
│   ├── data/
│   │   ├── crownline-data.json
│   │   ├── crownline-data.schema.json
│   │   └── loadCrownlineData.ts
│   ├── domain/
│   │   ├── chronology.ts
│   │   ├── dataValidation.ts
│   │   ├── selectors.ts
│   │   └── types.ts
│   ├── styles/
│   │   └── styles.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── scripts/
│   └── validate-data.ts
└── tests/
    ├── app.test.tsx
    ├── chronology.test.ts
    ├── data-integrity.test.ts
    └── data-validation.test.ts
```

现有字体移动到 `src/assets/fonts/`，由 Vite 解析 CSS 引用并生成带哈希的相对 URL，避免 GitHub Pages 子路径失效。现有 CSS 移到 `src/styles/styles.css` 并由 `main.tsx` 导入。旧的 `data/dynasties.js` 在新数据和页面验证完成后删除，避免维护两份事实源。

## 数据根对象

数据文件为 UTF-8 JSON，根结构如下：

```ts
interface CrownlineData {
  schemaVersion: 1;
  chronologyPolicy: ChronologyPolicy;
  timelineSections: TimelineSection[];
  entities: HistoricalEntity[];
  regions: Region[];
  persons: Person[];
  reigns: Reign[];
  relationships: Relationship[];
  events: HistoricalEvent[];
  sources: Source[];
}
```

所有集合通过稳定 ID 关联。时间轴阶段只保存 `entityIds`，不再嵌套完整实体。

## 稳定 ID

- ID 必须匹配 `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`。
- ID 在整个数据文件中全局唯一，不只在单个集合内唯一。
- 使用类型前缀，例如 `polity-cn-tang`、`period-cn-warring-states`、`person-cn-wu-zetian`、`source-cn-chronology-table`。
- ID 一旦发布，不因名称、拼写、分类或采用口径变化而修改，也不得复用已废弃 ID。

## 实体分类

实体的三个分类维度分别承担不同职责：

```ts
type EntityKind = "polity" | "historical-period";

type PolityForm =
  | "dynasty"
  | "empire"
  | "kingdom"
  | "khanate"
  | "state"
  | "other";

type DisplayCategory =
  | "mainline"
  | "contemporary"
  | "regional"
  | "context";
```

- `entityKind` 决定实体能否进入“当时存在的政权”结果。
- `polityForms` 可包含多个值，避免把“王朝”和“帝国”误建模为互斥分类；历史分期使用空数组。
- `displayCategory` 只控制当前时间轴的筛选、颜色和视觉层级，不表达实体本体性质。

## 纪年与区间口径

内部年份采用历史纪年整数：负数表示公元前，正数表示公元后，禁止 0。所有存在区间均为闭区间，开始年和结束年都包含。

“某年存在”定义为实体在该自然年的任意时刻曾存在。因此同一政权交替发生的年份可以同时显示双方。例如唐使用 `618—690`、`705—907`，武周使用 `690—705`；唐在 691—704 年不显示。西秦使用 `385—400`、`409—431`，在 401—408 年不显示。

年份不能直接做跨纪元算术。领域层先转换为连续序数：公元前 1 年映射为 0，公元 1 年映射为 1。年份加减、区间时长、轴线比例和后续滑杆都使用序数。

```ts
type DatePrecision = "exact" | "circa" | "decade" | "century" | "unknown";

interface HistoricalDate {
  year: number;
  precision: DatePrecision;
}

interface HistoricalInterval {
  start: HistoricalDate;
  end: HistoricalDate;
}
```

`existencePeriods` 是计算事实源。常规纪年文本从区间生成；仅在“1636（1644 入关）—1912”等传统说明无法由区间表达时允许 `displayRangeOverride`，该字段不得参与任何计算。

争议采用 `chronologyStatus: "disputed"`、`chronologyNote`、`alternativeChronologies` 和来源引用表达。备选口径不覆盖当前项目采用的主区间，UI 必须能说明采用口径而不是静默选择。

## 地区职责

地区引用分为三个独立字段：

- `historicalRegionIds`：用于历史空间归属和阶段 2 的主要筛选。
- `culturalSphereIds`：描述文化联系，不表示政治控制或精确疆域。
- `modernAreaIds`：用于现代读者检索和数据覆盖说明，不得推断历史主权、边界、接壤或空间重叠。

地区记录带 `regionKind` 枚举。阶段 0.5 只迁移当前数据能够可靠支持的宽粒度地区，文化圈和现代范围允许为空；阶段 2 再用少量外部数据验证多地区机制。

## 人物、任期、关系、事件与来源

人物与任期分开：人物保存姓名和别名；任期通过 `personId`、`polityId`、称号、角色和一个或多个任期区间关联。任期支持共治、摄政、争位和中断，但阶段 0.5 不要求补齐实际人物数据。

关系使用参与方数组而不是固定 `left/right`，每个参与方带角色，以支持战争、联盟、朝贡、臣属和外交等有向或无向关系。关系必须带类型、摘要、可信度、来源和可选有效区间，可引用少量事件。

事件拥有独立 ID、类型、日期或区间、参与实体、可选地点和来源。事件是关系的可选补充，不扩展为完整知识图谱。

来源记录包含标题、来源类型、引用文本、可选 URL、作者/机构和访问日期。各实体使用 `sourceRefs` 引用来源并附可选页码、章节或定位说明。可信度枚举为 `high | medium | low | disputed`；`low` 或 `disputed` 必须带说明。

人物、任期、关系和事件集合可以为空。契约和测试使用独立测试夹具覆盖这些结构，生产数据不放置未经校订的占位史实。

## 校验分层

第一层由 Ajv 执行 JSON Schema 校验，负责对象形状、字段类型、必填字段、ID 格式和枚举。

第二层由 TypeScript 语义校验器负责 JSON Schema 无法可靠表达的跨记录规则：

- 全局重复 ID。
- 年份为 0、区间倒置、未排序、重叠或可无损合并。
- 时间轴、地区、人物、任期、关系、事件和来源的悬空引用。
- 历史分期拥有政权形态或政权缺少存在区间。
- 关系参与方不足两个或重复。
- 争议、低可信度记录缺少说明或来源。

校验结果为带 `code`、`path` 和 `message` 的结构化问题数组。CLI 输出可读错误并以非零状态退出；应用加载失败时显示数据错误状态，不以部分坏数据继续渲染。

## React 页面边界

`App` 持有当前搜索词、展示类别和详情实体 ID。当前阶段不引入全局状态库；这些状态仍足够局部，阶段 1 增加共享年份和 URL 状态时再评估使用 Context 与 reducer。

- `FilterPanel`：搜索框、类别下拉、清除按钮和图例。
- `Timeline`：查询实体、按阶段分组并处理空结果。
- `TimelineStage`：渲染坐标轴、条目标签和一个或多个存在区间条。
- `DetailDialog`：展示分类、名称、年代、说明、阶段和多区间总时长，并负责焦点恢复。

搜索、分类、详情和多段时间条通过用户行为测试覆盖。现有 CSS 类名尽量保持，避免无关视觉回归。

## 数据流与错误处理

```text
crownline-data.json
        │
        ├─► Ajv JSON Schema 校验
        │
        ├─► 语义与引用校验
        │
        └─► ID 索引 ─► React selectors ─► 页面组件
```

开发环境和测试环境在加载数据时执行两层校验。生产构建仍在应用启动时校验一次；当前 73 条实体的数据量不会造成可感知开销。失败时页面显示“历史数据校验失败”，控制台输出具体路径，避免单条坏记录污染搜索和时间计算。

## 构建与部署

Vite 使用相对 `base: "./"`，使 `dist/` 可部署到 GitHub Pages 仓库子路径。字体、代码和 CSS 都由 Vite 生成带哈希的相对资源 URL。

开发、校验和发布命令为：

```bash
npm run dev
npm run validate:data
npm run test
npm run typecheck
npm run build
npm run preview
```

不在本阶段引入客户端路由，因此 GitHub Pages 不需要 SPA 回退规则。

## 测试与验收

- 纪年单元测试覆盖公元前、公元后、跨纪元、无公元 0、端点、时长和多区间。
- 校验器测试通过最小无效夹具证明重复 ID、坏区间、悬空引用、未知枚举和缺失字段会失败。
- 数据完整性测试加载真实 JSON，确认 7 个阶段、73 个实体、唐和西秦多段区间以及所有引用有效。
- 组件测试覆盖搜索、分类、清除筛选、空结果、打开/关闭详情和多段时间条。
- `tsc --noEmit`、Vitest、数据校验和 Vite 生产构建全部成功。
- 使用开发服务器和生产预览分别完成桌面、手机视口、浅色、深色、键盘和详情弹窗烟测。
- 更新 README 的开发、数据维护和 GitHub Pages 说明；完成全部验证后再勾选 ROADMAP 阶段 0.5。

## 迁移顺序

1. 建立 Vite、React、TypeScript 和测试骨架。
2. 测试先行实现纪年领域函数。
3. 定义 TypeScript 类型与 JSON Schema，测试先行实现语义校验器。
4. 将真实数据迁移为规范化 JSON 并通过完整性校验。
5. 将现有页面迁移为 React 组件并保持视觉和交互。
6. 完成类型检查、测试、数据校验、构建和浏览器烟测。
7. 更新 README 与 ROADMAP。

每一步必须保留可独立验证的交付物。依赖、根配置、旧文件删除和 Git 提交均在实际执行记录中明确说明，不进行远程 push 或 PR 操作。
