# Crownline 数据契约与 React/Vite 迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 TypeScript 7、React、Vite、JSON Schema 与 Ajv 完成阶段 0.5 数据契约，并保持当前时间轴体验和 GitHub Pages 静态部署。

**Architecture:** 历史数据迁移为规范化 JSON，JSON Schema 负责结构校验，TypeScript 语义校验器负责 ID、区间和引用规则。React 组件只消费已经校验的数据，纪年计算集中在无 UI 依赖的领域函数中。

**Tech Stack:** TypeScript 7、React 19、Vite、JSON Schema Draft 2020-12、Ajv 8、Vitest、Testing Library、tsx。

## Global Constraints

- 保持现有页面的信息架构、文案基调、响应式布局和深色模式。
- 不实现阶段 1 之后的年份控件、地区选择、对比或地图功能。
- 不引入 Router、全局状态库、组件库、CSS-in-JS、后端或 TypeScript 编程 API 消费方。
- 历史年份禁止 0；存在区间使用闭区间；选择某年表示该实体在该年任意时刻存在。
- `existencePeriods` 是历史计算事实源，展示覆盖文本不得参与计算。
- GitHub Pages 使用相对构建基址；不保留 `file://` 直接打开能力。
- 不创建 Git 提交、push 或 PR。

---

## 文件结构

- `package.json`：命令、运行依赖和开发依赖。
- `tsconfig.json`：TypeScript 7 严格模式和 Vite bundler 模块解析。
- `vite.config.ts`：React 插件、相对 base 和 Vitest/jsdom 配置。
- `src/domain/types.ts`：v1 数据契约的 TypeScript 类型和枚举常量。
- `src/domain/chronology.ts`：历史年份序数、格式化、区间包含和总时长。
- `src/domain/dataValidation.ts`：Ajv 与跨记录语义校验。
- `src/domain/selectors.ts`：搜索、展示分类和阶段实体解析。
- `src/data/crownline-data.schema.json`：Draft 2020-12 JSON Schema。
- `src/data/crownline-data.json`：迁移后的唯一生产数据源。
- `src/data/loadCrownlineData.ts`：验证真实数据并返回结果。
- `src/components/*.tsx`：筛选、时间轴阶段、多段时间条和详情弹窗。
- `src/app/App.tsx`：页面状态和整体结构。
- `src/main.tsx`：React 入口和样式导入。
- `src/styles/styles.css`：迁移后的现有样式及多段条所需最小补充。
- `scripts/validate-data.ts`：命令行数据校验入口。
- `tests/*.test.ts(x)`：领域、校验、数据完整性和用户行为测试。

### Task 1: 建立 TypeScript 7/Vite/React 工具链

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Create: `tests/setup.ts`

**Interfaces:**
- Produces: `npm run dev|test|typecheck|validate:data|build|preview`。
- Produces: Vitest `jsdom` 环境和 `@testing-library/jest-dom` 断言。

- [ ] **Step 1: 写入 package 脚本和依赖声明**

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "validate:data": "node --import tsx scripts/validate-data.ts",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: 配置 TypeScript 7**

使用 `strict: true`、`module: "ESNext"`、`moduleResolution: "Bundler"`、`resolveJsonModule: true`、`jsx: "react-jsx"`、`noEmit: true`，包含 `src`、`tests`、`scripts` 和 `vite.config.ts`。

- [ ] **Step 3: 配置 Vite 与 Vitest**

设置 `base: "./"`、React 插件、`environment: "jsdom"`、`setupFiles: ["./tests/setup.ts"]` 和 CSS 开启。

- [ ] **Step 4: 安装并确认 TypeScript 主版本**

```bash
npm install react react-dom ajv
npm install -D typescript vite @vitejs/plugin-react vitest jsdom tsx @types/node @types/react @types/react-dom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npx tsc --version
```

预期：`tsc` 输出 `Version 7.x.x`。

### Task 2: 测试先行实现历史纪年领域函数

**Files:**
- Create: `tests/chronology.test.ts`
- Create: `src/domain/chronology.ts`
- Create: `src/domain/types.ts`

**Interfaces:**
- Produces: `toOrdinal(year: number): number`。
- Produces: `nextHistoricalYear(year: number): number` 与 `previousHistoricalYear(year: number): number`。
- Produces: `isYearInPeriods(year: number, periods: HistoricalInterval[]): boolean`。
- Produces: `calculatePeriodsDuration(periods: HistoricalInterval[]): number`。
- Produces: `formatHistoricalYear(date: HistoricalDate): string` 与 `formatPeriods(periods, override?): string`。

- [ ] **Step 1: 写失败测试**

```ts
expect(() => toOrdinal(0)).toThrow("历史年份不存在公元 0 年");
expect(toOrdinal(-1)).toBe(0);
expect(nextHistoricalYear(-1)).toBe(1);
expect(previousHistoricalYear(1)).toBe(-1);
expect(isYearInPeriods(405, westernQinPeriods)).toBe(false);
expect(calculatePeriodsDuration(westernQinPeriods)).toBe(39);
expect(formatPeriods(westernQinPeriods)).toBe("385—400、409—431");
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

```bash
npm test -- tests/chronology.test.ts
```

- [ ] **Step 3: 实现最小纪年函数和共享类型**

实现非零整数检查、连续序数转换、闭区间判断、多区间总时长和 `circa` 的“约”前缀。

- [ ] **Step 4: 运行测试并确认通过**

```bash
npm test -- tests/chronology.test.ts
```

### Task 3: 测试先行建立 JSON Schema 与语义校验器

**Files:**
- Create: `tests/data-validation.test.ts`
- Create: `src/data/crownline-data.schema.json`
- Create: `src/domain/dataValidation.ts`

**Interfaces:**
- Consumes: `CrownlineData`、`HistoricalInterval`、`toOrdinal`。
- Produces: `validateCrownlineData(input: unknown): ValidationResult`。
- Produces: `ValidationIssue { code: string; path: string; message: string }`。

- [ ] **Step 1: 写 JSON Schema 失败测试**

用最小有效夹具作为基线，分别删除 `schemaVersion`、加入未知 `displayCategory`、把年份设为 0，并断言返回对应路径。

- [ ] **Step 2: 运行测试并确认因校验器不存在而失败**

```bash
npm test -- tests/data-validation.test.ts
```

- [ ] **Step 3: 写 Draft 2020-12 Schema**

完整定义根集合、实体、地区、人物、任期、关系、事件、来源、ID 正则、必填字段和枚举，并对生产对象使用 `additionalProperties: false`。

- [ ] **Step 4: 实现 Ajv 结构校验**

使用 `ajv/dist/2020.js` 编译 Schema，将 Ajv 错误转换为 `SCHEMA_ERROR` 与 JSON Pointer 路径。

- [ ] **Step 5: 写语义校验失败测试**

覆盖全局重复 ID、倒置/重叠/相邻可合并区间、时间轴悬空实体、来源悬空引用、历史分期带政权形态、重复关系参与方和争议记录缺少说明。

- [ ] **Step 6: 实现语义校验并运行测试**

```bash
npm test -- tests/data-validation.test.ts
```

### Task 4: 迁移 73 个生产条目

**Files:**
- Create: `tests/data-integrity.test.ts`
- Create: `src/data/crownline-data.json`
- Create: `src/data/loadCrownlineData.ts`
- Create: `scripts/validate-data.ts`
- Delete after green: `data/dynasties.js`

**Interfaces:**
- Consumes: `validateCrownlineData`、`CrownlineData`。
- Produces: `loadCrownlineData(): CrownlineData`，校验失败时抛出包含 issue 路径的错误。
- Produces: CLI 在有效数据时输出实体/阶段数量，在无效时退出码为 1。

- [ ] **Step 1: 写真实数据完整性失败测试**

```ts
expect(data.timelineSections).toHaveLength(7);
expect(data.entities).toHaveLength(73);
expect(tang.existencePeriods).toHaveLength(2);
expect(westernQin.existencePeriods).toHaveLength(2);
expect(validateCrownlineData(data).valid).toBe(true);
```

- [ ] **Step 2: 运行测试并确认因 JSON 数据不存在而失败**

```bash
npm test -- tests/data-integrity.test.ts
```

- [ ] **Step 3: 机械迁移当前数据并人工补充稳定字段**

将 7 个阶段改为 `entityIds` 引用；为 73 个实体赋全局唯一 ASCII ID；将 aliases 拆为数组；将 `period` 映射为 `historical-period/context`；将其余旧分类映射为 `polity` 与 `mainline/contemporary/regional`；加入宽粒度东亚地区和现有两条资料来源。

- [ ] **Step 4: 修正中断与传统显示**

唐使用 `618—690`、`705—907`，西秦使用 `385—400`、`409—431`；清保留 `displayRangeOverride: "1636（1644入关）—1912"`。所有计算只读结构化区间。

- [ ] **Step 5: 实现加载器和 CLI**

`loadCrownlineData` 在模块加载后校验真实 JSON；CLI 打印 `数据校验通过：7 个阶段，73 个实体` 或逐行输出 `[code] path message`。

- [ ] **Step 6: 运行完整性和 CLI 校验**

```bash
npm test -- tests/data-integrity.test.ts
npm run validate:data
```

### Task 5: 测试先行迁移 React 页面行为

**Files:**
- Create: `tests/app.test.tsx`
- Create: `src/domain/selectors.ts`
- Create: `src/components/FilterPanel.tsx`
- Create: `src/components/Timeline.tsx`
- Create: `src/components/TimelineStage.tsx`
- Create: `src/components/DetailDialog.tsx`
- Create: `src/app/App.tsx`
- Create: `src/main.tsx`

**Interfaces:**
- Produces: `filterEntities(data, query, category): MatchedEntity[]`。
- Produces: `App({ data }: { data: CrownlineData })`。
- Components consume IDs and typed entities; no component reads raw JSON by path.

- [ ] **Step 1: 写选择器和用户行为失败测试**

覆盖初始 `73` 个结果、名称/别名搜索、展示类别筛选、清除、空状态、打开详情、Esc 关闭详情、西秦两个时间条和按多区间计算的持续年数。

- [ ] **Step 2: 运行测试并确认组件不存在**

```bash
npm test -- tests/app.test.tsx
```

- [ ] **Step 3: 实现选择器与最小组件树**

`App` 只持有 `query`、`displayCategory` 和 `selectedEntityId`；`Timeline` 按 section 的 `entityIds` 保序；`TimelineStage` 对每个 `existencePeriods` 渲染一个 button。

- [ ] **Step 4: 实现详情与可访问性**

使用原生 `<dialog>`，按钮具备包含名称、年代和分类的 `aria-label`；关闭后焦点返回触发按钮；空状态和数据错误使用可读文本。

- [ ] **Step 5: 运行组件与全部测试**

```bash
npm test -- tests/app.test.tsx
npm test
```

### Task 6: 迁移静态资源与 Vite 入口

**Files:**
- Modify: `index.html`
- Create: `src/styles/styles.css`
- Move: `assets/fonts/*` to `src/assets/fonts/*`
- Delete after green: `assets/styles.css`

**Interfaces:**
- Consumes: `src/main.tsx`。
- Produces: Vite 页面入口、现有视觉样式和生产字体路径。

- [ ] **Step 1: 将 index.html 缩减为页面元信息与 `#root`**

保留 SEO、主题色和结构化数据；入口改为 `<script type="module" src="/src/main.tsx"></script>`。旧字体 preload 因构建后文件名带哈希而移除。

- [ ] **Step 2: 迁移 CSS 与字体路径**

复用现有选择器，只为 React 根、数据错误和多段时间条增加必要样式；CSS 使用相对 `../assets/fonts/...` 引用源字体，由 Vite 输出带哈希的相对路径。

- [ ] **Step 3: 运行组件测试、类型检查和构建**

```bash
npm test
npm run typecheck
npm run build
```

### Task 7: 文档、路线图和最终验收

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: 所有最终命令和数据契约。
- Produces: 安装、开发、校验、构建、GitHub Pages 与数据维护说明。

- [ ] **Step 1: 更新 README**

将“无需安装、直接打开”改为 Node/npm/Vite 工作流；记录 JSON 数据、Schema、稳定 ID、多区间和 `npm run validate:data`；保留 GitHub Pages 静态部署说明。

- [ ] **Step 2: 完整执行质量门禁**

```bash
npm run validate:data
npm run typecheck
npm test
npm run build
```

- [ ] **Step 3: 开发和生产预览烟测**

分别启动 `npm run dev -- --host 127.0.0.1` 与 `npm run preview -- --host 127.0.0.1`，检查桌面/手机、浅色/深色、键盘筛选、详情和唐/西秦多段条。

- [ ] **Step 4: 更新 ROADMAP**

只有在数据校验、类型检查、测试、构建和烟测均成功后，才勾选阶段 0.5 的八项要求，并在修订说明记录 React/Vite/TypeScript 7 工程化迁移。
