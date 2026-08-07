# 阶段 3：政权详情与统治者实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 16 个中国主线政权补充可追溯的统治者与任期数据，并让政权详情在时间点模式准确区分单人、多人、争议、空位和资料未校订状态。

**Architecture:** 数据契约升级为 v3，以现有 `persons` / `reigns` 和新增 `reignVacancies` 显式表达史料事实；纯领域选择器把指定年份转换为稳定的统治者快照；React 详情弹窗只消费快照和来源解析结果。所有历史区间沿用无公元 0 年、闭区间与“年内任一时刻命中”规则。

**Tech Stack:** React 19、TypeScript 7、Vite 8、JSON Schema 2020-12、Ajv、Vitest、Testing Library。

## Global Constraints

- 覆盖现有 16 个中国主线政权；不能可靠落年的早期或争议记录必须披露不确定性，不虚构连续精确年表。
- 资料缺失不得解释为空位；只有 `reignVacancies` 中有来源支持的记录才能显示空位。
- 不新增运行时依赖，不修改浏览 URL 契约，不提前实现阶段 4A。
- 新增或修改的代码使用简洁中文注释解释历史年份语义、状态优先级、空位与资料缺失的区别及不直观的跨记录校验；不逐行注释显而易见的 JSX 和赋值。
- 当前任务不创建提交、分支、推送或 PR；Git 历史操作等待用户另行授权。

---

### Task 1: 数据契约 v3 与语义校验

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/data/crownline-data.schema.json`
- Modify: `src/domain/dataValidation.ts`
- Modify: `tests/data-validation.test.ts`

**Interfaces:**
- Produces: `Reign.localTitles?: string[]`
- Produces: `ReignVacancy`
- Produces: `CrownlineData.schemaVersion: 3`
- Produces: `CrownlineData.reignVacancies: ReignVacancy[]`

- [ ] **Step 1: 将最小测试数据迁移为 v3，并写失败测试**

在 `makeValidData()` 中加入 `schemaVersion: 3` 与 `reignVacancies: []`，然后增加测试夹具人物、任期和空位记录。失败断言覆盖以下代码：

```ts
expect(issueCodes(reignOnHistoricalPeriod)).toContain("INVALID_REIGN_POLITY")
expect(issueCodes(reignOutsidePolity)).toContain("REIGN_OUTSIDE_POLITY")
expect(issueCodes(vacancyOutsidePolity)).toContain("VACANCY_OUTSIDE_POLITY")
expect(issueCodes(overlappingVacancy)).toContain("VACANCY_REIGN_OVERLAP")
expect(issueCodes(danglingVacancySource)).toContain("DANGLING_SOURCE_REF")
```

- [ ] **Step 2: 运行定向测试并确认因 v3 能力缺失而失败**

Run: `npm test -- tests/data-validation.test.ts`

Expected: FAIL；失败原因是类型、schema 或校验尚不支持 `reignVacancies`，而不是测试语法错误。

- [ ] **Step 3: 实现最小 v3 类型与 JSON Schema**

在 `types.ts` 添加：

```ts
export interface ReignVacancy {
  id: string;
  polityId: string;
  periods: HistoricalInterval[];
  note: string;
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}
```

把 `CrownlineData.schemaVersion` 改为 `3` 并加入 `reignVacancies`；在 `Reign` 加入 `localTitles?: string[]`。Schema 同步限制非空数组、非空字符串、合法 ID、区间、来源与可信度。

- [ ] **Step 4: 实现跨记录校验**

建立 `entityById`；校验任期和空位只引用 `polity`，各区间被政权的某个存在区间完整包含。按政权比较空位与任期区间，重叠时返回 `VACANCY_REIGN_OVERLAP`。将空位加入全局 ID 命名空间，并复用 `validatePeriods`、`validateSourceRefs`、`validateConfidenceNote`。

- [ ] **Step 5: 运行定向测试并保持全绿**

Run: `npm test -- tests/data-validation.test.ts`

Expected: PASS。

---

### Task 2: 当年统治者快照选择器

**Files:**
- Create: `src/domain/rulerSnapshot.ts`
- Create: `tests/ruler-snapshot.test.ts`

**Interfaces:**
- Consumes: `CrownlineData`, `Person`, `Reign`, `ReignVacancy`, `isYearInPeriods()`
- Produces: `RulerSnapshotStatus`, `RulerSnapshotEntry`, `RulerSnapshot`, `selectRulerSnapshot(data, polityId, year)`

- [ ] **Step 1: 写选择器失败测试**

使用内存 v3 数据覆盖以下手工结果：

```ts
expect(selectRulerSnapshot(data, "polity-test", 2).status).toBe("known")
expect(selectRulerSnapshot(data, "polity-test", 4).entries.map(({ reign }) => reign.role))
  .toEqual(["ruler", "regent"])
expect(selectRulerSnapshot(data, "polity-test", 6).status).toBe("disputed")
expect(selectRulerSnapshot(data, "polity-test", 8).status).toBe("vacant")
expect(selectRulerSnapshot(data, "polity-test", 10).status).toBe("unrecorded")
expect(() => selectRulerSnapshot(data, "polity-missing", 2)).toThrow("polity-missing")
```

另测任期多段区间、闭区间端点及公元前 1 年到公元 1 年的连续语义。

- [ ] **Step 2: 运行测试并确认模块缺失失败**

Run: `npm test -- tests/ruler-snapshot.test.ts`

Expected: FAIL with module not found。

- [ ] **Step 3: 实现最小选择器**

使用 `isYearInPeriods` 收集任期，解析人物并按 `ruler → co-ruler → regent → contender`、最早任期、人物名排序。`contender`、争议年代或争议可信度触发 `disputed`；无任期时再查空位；两者皆无返回 `unrecorded`。用中文注释说明状态优先级是史料语义而非展示偏好。

- [ ] **Step 4: 运行选择器与年代回归测试**

Run: `npm test -- tests/ruler-snapshot.test.ts tests/chronology.test.ts`

Expected: PASS。

---

### Task 3: 16 个中国主线政权统治者数据

**Files:**
- Modify: `src/data/crownline-data.json`
- Modify: `tests/data-integrity.test.ts`

**Interfaces:**
- Consumes: v3 `persons`, `reigns`, `reignVacancies`, `sources`
- Produces: 16 个主线政权均至少一条任期；西周共和行政空位记录；可验收的单人、多人、争议和无资料年份。

- [ ] **Step 1: 检索并核对史料来源**

为夏、商、西周/东周、秦汉、两晋、隋唐、宋、元、明、清分别选择可直接访问的机构、学术或可靠专题年表来源。记录标题、完整 citation、URL、作者/机构和必要定位；同一来源可被同一时期多条人物与任期复用。

- [ ] **Step 2: 写生产数据完整性失败测试**

增加以下行为断言：

```ts
const mainlineIds = data.entities
  .filter(({ entityKind, displayCategory }) => entityKind === "polity" && displayCategory === "mainline")
  .map(({ id }) => id)
expect(mainlineIds).toHaveLength(16)
expect(new Set(data.reigns.map(({ polityId }) => polityId))).toEqual(new Set(mainlineIds))
expect(data.persons.length).toBeGreaterThan(0)
expect(data.reignVacancies.some(({ polityId }) => polityId === "polity-cn-western-zhou")).toBe(true)
```

并使用 `selectRulerSnapshot` 对真实数据断言：明 1400 年为 `known`、清 1862 年同时包含皇帝与摄政者、夏前 2000 年为 `disputed`、西周前 840 年为 `vacant`、拜占庭帝国 1000 年为 `unrecorded`。

- [ ] **Step 3: 运行完整性测试并确认数据缺失失败**

Run: `npm test -- tests/data-integrity.test.ts`

Expected: FAIL，因为生产 JSON 尚未迁移到 v3 且人物、任期为空。

- [ ] **Step 4: 迁移生产 JSON 并录入统治者数据**

把 schema 版本改为 3，加入 `reignVacancies`。按政权顺序录入人物与任期：夏、商、西周、东周、秦、西汉、东汉、西晋、东晋、隋、唐、北宋、南宋、元、明、清。每个人物和任期绑定来源；通行纪年不确定的记录使用 `circa` / `unknown` 与 `disputed` 说明。西周共和行政使用显式空位记录；唐的任期不得穿过 691—704 的政权中断。

- [ ] **Step 5: 校验生产数据并修正全部具体问题**

Run: `npm run validate:data`

Expected: 输出数据校验通过；不得通过放宽 schema 或删除错误记录掩盖越界、冲突或悬空引用。

- [ ] **Step 6: 运行完整性与选择器测试**

Run: `npm test -- tests/data-integrity.test.ts tests/ruler-snapshot.test.ts`

Expected: PASS。

---

### Task 4: 强化详情弹窗与当年统治者界面

**Files:**
- Modify: `src/components/DetailDialog.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/styles.css`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- Consumes: `selectRulerSnapshot()`, `CrownlineData`, `currentYear?: number`
- Produces: `DetailDialog({ entity, sectionTitle, data, currentYear, onClose })`

- [ ] **Step 1: 写详情行为失败测试**

在时间点 URL 下打开主线政权详情并断言当前年份标题、人物、角色、任期和来源；使用可控内存数据分别覆盖多人、争议、空位和无资料。全览模式断言提示切换时间点且不显示隐藏年份；历史分期断言没有统治者区域。

关键文案断言：

```ts
expect(within(dialog).getByRole("heading", { name: /在位统治者/ })).toBeInTheDocument()
expect(within(dialog).getByText("已有资料记为空位期")).toBeInTheDocument()
expect(within(dialog).getByText(/不等于当时无人统治/)).toBeInTheDocument()
expect(within(dialog).getByText(/切换到时间点模式/)).toBeInTheDocument()
```

- [ ] **Step 2: 运行界面测试并确认缺失行为失败**

Run: `npm test -- tests/app.test.tsx`

Expected: FAIL，因为详情尚未消费当前年份、任期和来源。

- [ ] **Step 3: 实现详情数据组合与语义结构**

`App` 传入完整 `data`，只在 `browseState.mode === "point"` 时传 `currentYear`。`DetailDialog` 解析地区、形态、可信度、替代口径和快照；来源以 `sourceId` 分组并合并 locator/note。使用 section、article、dl、ul 等语义元素，保留原生 dialog、Escape、遮罩关闭和焦点恢复。

- [ ] **Step 4: 实现史册式响应布局**

弹窗使用受视口限制的高度和内部滚动；元数据为紧凑网格，统治者区以强调边框和角色徽章区分状态，来源列表保持长 URL 可换行。浅色、深色和 760px 以下布局均沿用既有 CSS 变量。状态不能只靠颜色表达。

- [ ] **Step 5: 运行界面测试并保持全绿**

Run: `npm test -- tests/app.test.tsx`

Expected: PASS，并保留现有详情关闭、模态和焦点测试。

---

### Task 5: 文档、字体与阶段验收

**Files:**
- Modify: `docs/data-contract.md`
- Modify: `README.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: 最终 v3 契约、真实覆盖统计、通过的测试结果
- Produces: 阶段 3 完成记录与准确的数据覆盖说明

- [ ] **Step 1: 更新数据契约文档**

把标题改为 v3，说明 `localTitles`、`reignVacancies`、快照四状态、任期/空位边界、共和行政示例以及“无记录不等于空位”。删除“人物、任期尚未填充”的旧说明。

- [ ] **Step 2: 更新 README 与 ROADMAP**

README 当前功能加入详情元数据、来源和当年统治者；数据维护加入 v3 规则。ROADMAP 勾选阶段 3 五项，在完成记录中写明 16 个主线政权覆盖、早期争议处理和四状态展示，但不声称非主线或全球数据已补齐。

- [ ] **Step 3: 运行字体检查并按结果处理**

Run: `npm run check:fonts`

Expected: PASS。若新增中文字符缺失，运行 `npm run regen:fonts` 后再次运行 `npm run check:fonts`，只保留实际需要更新的字体子集。

- [ ] **Step 4: 执行完整质量门禁**

Run: `npm run validate:data && npm test && npm run typecheck && npm run build`

Expected: 所有命令 exit 0，无测试失败、类型错误或构建错误。

- [ ] **Step 5: 检查改动边界与注释质量**

Run: `git diff --check && git status --short`

逐项核对设计验收：16 个主线政权、详情元数据、来源、四状态、共治/摄政/争位/空位/中断/不确定性、无障碍、文档和必要中文注释。确认没有无关文件、调试输出、占位符或未经授权的 Git 历史操作。
