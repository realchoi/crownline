# 地区范围与跨地区时间点浏览实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在时间点模式落地“中国 / 自选地区 / 全球已收录”，并用少量外部数据验证地区层级、多地区归属、URL 恢复和覆盖提示。

**Architecture:** 地区范围作为共享浏览状态进入 URL；纯领域函数负责展开地区层级、组合地区/年份/搜索/类别过滤并返回空状态原因。时间点查询直接遍历全部实体，现有中国全览仍按 `timelineSections` 展示，完整多地区全览留给路线图阶段 2B。

**Tech Stack:** React 19、TypeScript 7、JSON Schema 2020-12、Ajv、Vitest、Testing Library。

## Global Constraints

- “全球已收录”只表示当前数据集，不暗示世界历史已完整覆盖。
- 多地区选择采用并集；跨地区实体在结果中去重。
- 仅 `historical-region` 参与阶段 2 筛选；文化圈和现代范围不推断历史领土。
- 自选与全球范围本轮只进入时间点模式；全览切换保持中国时间轴语义。
- 所有历史数据带稳定 ID、来源和覆盖说明。

---

### Task 1: 地区数据契约 v2

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/data/crownline-data.schema.json`
- Modify: `src/domain/dataValidation.ts`
- Modify: `tests/data-validation.test.ts`
- Modify: `docs/data-contract.md`

- [x] 先写地区父引用、同类父子关系、循环和覆盖字段的失败测试。
- [x] 运行 `npm test -- tests/data-validation.test.ts`，确认因契约能力缺失而失败。
- [x] 增加地区名称、父地区与 `none | sample | partial` 覆盖状态，迁移到 schema v2。
- [x] 实现地区层级语义校验并让定向测试通过。

### Task 2: 地区范围与统一筛选

**Files:**
- Create: `src/domain/regionScope.ts`
- Modify: `src/domain/selectors.ts`
- Modify: `tests/selectors.test.ts`

- [x] 先写中国预设、后代展开、自选并集、全球、去重和三类空状态的失败测试。
- [x] 运行定向测试并确认 RED。
- [x] 实现 `RegionScope`、地区展开与直接遍历全部实体的选择器。
- [x] 补入本地名、地区名搜索，运行定向测试确认 GREEN。

### Task 3: URL 浏览状态

**Files:**
- Modify: `src/domain/browseState.ts`
- Modify: `tests/browse-state.test.ts`

- [x] 先写 `scope` 与重复 `region` 参数的恢复、清洗和默认省略测试。
- [x] 运行定向测试并确认 RED。
- [x] 扩展 `BrowseState`、读取与序列化逻辑，运行定向测试确认 GREEN。

### Task 4: 地区选择界面与状态提示

**Files:**
- Create: `src/components/RegionScopeControl.tsx`
- Modify: `src/components/FilterPanel.tsx`
- Modify: `src/components/TimepointView.tsx`
- Modify: `src/components/DetailDialog.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/styles.css`
- Modify: `tests/app.test.tsx`

- [x] 先写三种范围切换、多选、URL 同步、地区标签和空状态文案的失败界面测试。
- [x] 运行界面测试并确认 RED。
- [x] 实现紧凑“观测范围带”、键盘可操作多选和覆盖说明。
- [x] 让全览明确回到中国范围，运行界面测试确认 GREEN。

### Task 5: 代表性外部数据与交付验证

**Files:**
- Modify: `src/data/crownline-data.json`
- Modify: `tests/data-integrity.test.ts`
- Modify: `README.md`
- Modify: `ROADMAP.md`

- [x] 先写生产数据包含多个外部地区、代表政权和多地区实体的失败完整性测试。
- [x] 加入拜占庭帝国、阿拔斯哈里发、神圣罗马帝国和朱罗帝国及可核查来源。
- [x] 更新 README、数据覆盖说明与路线图阶段完成记录。
- [x] 运行 `npm run validate:data && npm test && npm run typecheck && npm run build`。
