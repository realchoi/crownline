# 全球政权均衡补样实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有数据契约和浏览架构上新增 16 个全球代表性政权，并为它们补齐地区、统治者、任期、来源和回归验证。

**Architecture:** 继续使用 `src/data/source/` 下的 JSON 分片作为唯一人工维护源。实体分片由 `scripts/data-source.ts` 递归聚合，经 `validateCrownlineData` 校验后由 `src/data/artifacts.ts` 生成首屏索引和详情闭包；新增数据不需要新的加载器或 React 页面层。

**Tech Stack:** React 19、TypeScript 7、Vite 8、Vitest、Ajv JSON Schema 2020-12、Node.js 20.19+ 或 22.12+。

## Global Constraints

- 使用负整数表示公元前，正整数表示公元后，不存在公元 0 年；区间两端均包含。
- 中断或复立政权使用多个 `existencePeriods`，不把不连续时期压成连续区间。
- `coverage.status` 只描述当前数据集；地区只有在对应实体实际落地后才改为 `sample`，不表示世界历史已经完整覆盖。
- 每个实体、人物和任期至少有一个有效 `sourceRefs`，所有引用必须指向 `sources.json` 中的稳定 ID。
- `polityForms` 表达政权形态，`displayCategory` 只表达时间轴展示层级；新增世界政权默认使用 `contemporary`，除非数据口径明确需要 `regional`。
- 具有跨越多个历史板块的政权可以绑定多个顶层历史地区；全览必须只显示一次。
- 只修改与本功能直接相关的数据、测试、覆盖说明和项目文档；不改依赖、Schema 版本、数据库、地图或关系模型。
- 不手工编辑 `public/data/generated/` 和 `.generated/`；所有产物由 `npm run generate:data` 生成。
- 每个数据批次完成后运行定向验证；最终运行 `npm run validate:data`、`npm test`、`npm run typecheck`、`npm run build` 和 `npm run check:fonts`。

## File Map

| 文件 | 责任 | 本次处理 |
| --- | --- | --- |
| `src/data/source/entities/world/*.json` | 世界政权、人物、任期分片 | 新增 16 个分片 |
| `src/data/source/regions/regions.json` | 地区层级与覆盖说明 | 新增东南亚、中亚、西非并更新现有覆盖文案 |
| `src/data/source/sources/sources.json` | 集中来源目录 | 增加新政权概述和统治者年表来源 |
| `tests/data-integrity.test.ts` | 真实数据的实体、地区、任期和快照断言 | 增加 16 个条目及批次断言 |
| `tests/data-artifacts.test.ts` | 首屏/详情闭包边界 | 增加 16 个世界详情闭包断言 |
| `tests/global-sample-polities.ts` | 16 个全球样本政权 ID 的共享测试常量 | 新建并供数据完整性与详情测试复用 |
| `tests/data-source.test.ts` | 源分片聚合和生成产物 | 移除过时的固定人物/任期总数，保留实体和详情数量断言 |
| `tests/selectors.test.ts` | 地区、年份和空结果选择器 | 将美洲从 `unindexed` 更新为 `limited-coverage` |
| `tests/overview-timeline.test.ts` | 多地区全览分组与去重 | 更新全球组和新增地区断言 |
| `tests/app.test.tsx` | 页面行为回归 | 更新全球数量、美洲提示和新增地区可见性 |
| `README.md`、`ROADMAP.md`、`docs/data-contract.md` | 当前覆盖范围和数量说明 | 根据最终生成摘要更新 |

不修改 `scripts/data-source.ts`、`scripts/generate-data.ts`、`src/data/artifacts.ts`、`src/components/RegionScopeControl.tsx` 或 `src/domain/regionScope.ts`；它们已经递归读取分片并按地区动态工作。

---

### Task 1: 先建立 16 个全球样本的失败回归测试

**Files:**
- Create: `tests/global-sample-polities.ts`
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/data-artifacts.test.ts`
- Modify: `tests/data-source.test.ts`
- Modify: `tests/selectors.test.ts`
- Modify: `tests/overview-timeline.test.ts`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- Consumes: 现有 `loadSourceData()`、`buildGeneratedArtifacts()`、`selectRulerSnapshot()`、`selectBrowseResults()` 和 `renderApp()`。
- Produces: 后续数据任务必须满足的 16 个稳定 ID、地区覆盖状态、详情闭包和时间点行为契约。

- [ ] **Step 1: 写入统一的 16 个实体 ID 常量和实体存在性断言**

新建 `tests/global-sample-polities.ts`，加入以下只读常量；在 `tests/data-integrity.test.ts` 和 `tests/data-artifacts.test.ts` 中导入它，并增加测试断言：

```ts
export const GLOBAL_SAMPLE_POLITY_IDS = [
  "polity-goryeo",
  "polity-tokugawa-shogunate",
  "polity-khmer-empire",
  "polity-majapahit",
  "polity-kushan-empire",
  "polity-timurid-empire",
  "polity-maurya-empire",
  "polity-mughal-empire",
  "polity-seljuk-empire",
  "polity-ottoman-empire",
  "polity-frankish-kingdom",
  "polity-kingdom-of-england",
  "polity-fatimid-caliphate",
  "polity-mali-empire",
  "polity-aztec-empire",
  "polity-inca-empire"
] as const;
```

在 `tests/data-integrity.test.ts` 中导入：

```ts
import { GLOBAL_SAMPLE_POLITY_IDS } from "./global-sample-polities";

it("收录全球均衡样本政权并为每条政权接入任期", () => {
  expect(data.entities).toHaveLength(93);
  expect(data.entities.map(({ id }) => id)).toEqual(
    expect.arrayContaining(GLOBAL_SAMPLE_POLITY_IDS)
  );
  for (const entityId of GLOBAL_SAMPLE_POLITY_IDS) {
    expect(data.reigns.some(({ polityId }) => polityId === entityId), entityId).toBe(true);
  }
});
```

- [ ] **Step 2: 写入地区覆盖、详情闭包和选择器失败断言**

增加以下具体断言：

```ts
const regionStatuses = new Map(data.regions.map(({ id, coverage }) => [id, coverage.status]));
expect(regionStatuses.get("region-southeast-asia")).toBe("sample");
expect(regionStatuses.get("region-central-asia")).toBe("sample");
expect(regionStatuses.get("region-west-africa")).toBe("sample");
expect(regionStatuses.get("region-americas")).toBe("sample");
```

在 `tests/data-artifacts.test.ts` 中导入同一常量并遍历它，断言每个详情包存在、`reigns` 非空、每条任期的 `polityId` 等于实体 ID、人物集合与任期 `personId` 集合一致、来源集合非空。

在 `tests/selectors.test.ts` 中把当前美洲断言改为：

```ts
expect(select(1000, "", "region-americas").polityEmptyReason).toBe("limited-coverage");
```

在 `tests/app.test.tsx` 中保留中国默认的 `73 / 73` 断言，将全球全览数量改为 `93 / 93`，并为 `东南亚`、`中亚`、`西非` 增加可见的地区复选框断言。美洲时间点测试继续断言“覆盖有限，不表示当时不存在政权”，不再断言“尚未收录”。

- [ ] **Step 3: 更新聚合测试的实体/详情数量断言**

在 `tests/data-source.test.ts` 中将 `summary` 的固定断言改为 `entities: 93`、`details: 93`，并使用已加载的 `data` 校验人物和任期总数，避免每次补充统治者时重复修改无关的聚合测试：

```ts
expect(summary).toMatchObject({ entities: 93, details: 93 });
expect(summary.persons).toBe(data.persons.length);
expect(summary.reigns).toBe(data.reigns.length);
```

- [ ] **Step 4: 运行失败测试确认测试先于数据落地**

Run: `npm test -- --run tests/data-integrity.test.ts tests/data-artifacts.test.ts tests/selectors.test.ts tests/overview-timeline.test.ts tests/app.test.tsx tests/data-source.test.ts`

Expected: FAIL，失败原因应为缺少 16 个实体、地区仍为 `none` 或全球总数仍为 77；不能出现测试编译错误。

- [ ] **Step 5: 提交测试基线**

```bash
git add tests/data-integrity.test.ts tests/data-artifacts.test.ts tests/data-source.test.ts tests/selectors.test.ts tests/overview-timeline.test.ts tests/app.test.tsx
git commit -m "test(history): 增加全球政权补样验收"
```

### Task 2: 增加地区目录并更新覆盖口径

**Files:**
- Modify: `src/data/source/regions/regions.json`
- Test: `tests/data-integrity.test.ts`（使用 Task 1 已添加的地区断言）

**Interfaces:**
- Consumes: 现有 `source-crownline-coverage` 来源和 `Region` Schema。
- Produces: `region-southeast-asia`、`region-central-asia`、`region-west-africa` 三个可被实体引用、地区选择器显示和 URL 恢复的历史地区。

- [ ] **Step 1: 新增三个历史地区记录**

在现有地区数组中加入：

```json
{
  "id": "region-southeast-asia",
  "names": { "primary": "东南亚", "aliases": ["Southeast Asia"] },
  "regionKind": "historical-region",
  "coverage": {
    "status": "none",
    "note": "东南亚已建立地区索引，代表性政权将在后续数据批次中加入；当前尚不代表东南亚没有历史政权。"
  },
  "description": "东南亚宽粒度历史地区；不代表精确疆域或现代主权范围。",
  "sourceRefs": [{ "sourceId": "source-crownline-coverage" }]
}
```

按照同一结构加入 `region-central-asia` 和 `region-west-africa`，分别使用中文主名“中亚”“西非”和英文别名 `Central Asia`、`West Africa`；两者在对应实体批次落地前都使用 `coverage.status: "none"`，并明确说明这是当前数据集的收录状态，不表示历史上没有政权。

- [ ] **Step 2: 更新已有地区 coverage.note 和 description**

将东亚、南亚、西亚、欧洲、北非的说明改为反映当前已经存在的条目；不要提前写入 Task 3–6 尚未落地的政权名称。美洲和三个新地区在本任务中保持 `status: "none"`，直到对应政权实际加入后再由后续任务改为 `sample`。所有这些记录继续引用 `source-crownline-coverage`，不创建虚构的地区学术来源。

- [ ] **Step 3: 运行地区与 Schema 定向校验**

Run: `npm run validate:data`

Expected: 命令通过；地区 Schema、覆盖状态和现有实体引用均无错误。Task 1 的测试仍会因为 16 个实体尚未加入而失败，但这不影响本命令的源数据校验。

- [ ] **Step 4: 提交地区目录变更**

```bash
git add src/data/source/regions/regions.json
git commit -m "feat(history): 扩展全球历史地区目录"
```

### Task 3: 加入东亚、东南亚和中亚六个政权

**Files:**
- Create: `src/data/source/entities/world/polity-goryeo.json`
- Create: `src/data/source/entities/world/polity-tokugawa-shogunate.json`
- Create: `src/data/source/entities/world/polity-khmer-empire.json`
- Create: `src/data/source/entities/world/polity-majapahit.json`
- Create: `src/data/source/entities/world/polity-kushan-empire.json`
- Create: `src/data/source/entities/world/polity-timurid-empire.json`
- Modify: `src/data/source/regions/regions.json`
- Modify: `src/data/source/sources/sources.json`
- Modify: `tests/data-integrity.test.ts`

**Interfaces:**
- Consumes: Task 1 的实体 ID 和 Task 2 的三个新地区。
- Produces: 6 个符合 `EntityFragment` 的世界分片，每个分片包含一个实体、人物、任期和必要的明确空位数组。

- [ ] **Step 1: 为每个政权完成来源登记后再写 JSON**

在 `sources.json` 中为每个政权登记至少两类来源：一条政权概述/年代来源和一条统治者年表来源。来源 ID 固定使用以下命名，实体与任期只能引用这些已登记 ID：

```text
source-goryeo-history              source-goryeo-rulers
source-tokugawa-history            source-tokugawa-rulers
source-khmer-history               source-khmer-rulers
source-majapahit-history           source-majapahit-rulers
source-kushan-history              source-kushan-rulers
source-timurid-history             source-timurid-rulers
```

每条来源填写 `title`、`sourceType`、`citation`、`publisher`、稳定 `url` 和本次访问日期；优先采用博物馆、大学、国家机构或学术参考资料，并用公开统治者列表做交叉核对。

- [ ] **Step 2: 按现有分片结构创建六个政权文件**

使用 `order` 780、790、800、810、820、830，依次对应高丽、德川幕府、高棉帝国、满者伯夷、贵霜帝国、帖木儿帝国。每个文件必须具有以下四个数组键：

```json
{
  "order": 780,
  "entities": [{ "id": "polity-goryeo" }],
  "persons": [],
  "reigns": [],
  "reignVacancies": []
}
```

实体对象补齐中文主名、英文别名、本地名、`polityForms`、`displayCategory: "contemporary"`、存在区间、年代状态、地区、简介、来源和可信度。高丽、德川幕府使用 `region-east-asia`；高棉帝国、满者伯夷使用 `region-southeast-asia`；贵霜帝国使用 `region-central-asia` 和 `region-south-asia`；帖木儿帝国使用 `region-central-asia` 和 `region-west-asia`，因为这两个政权的历史活动范围跨越相邻板块。

- [ ] **Step 3: 写入主要统治者和任期**

每个政权录入来源支持的主要统治者序列，任期采用历史年整数、闭区间和明确角色。至少覆盖以下验证锚点：高丽 1000 年、德川幕府 1700 年、高棉帝国 1200 年、满者伯夷 1350 年、贵霜帝国 150 年、帖木儿帝国 1400 年的 `rulerSnapshot` 均有 `known` 或有明确来源的 `disputed` 结果；早期贵霜年表的争议必须在 `chronologyNote`、任期 `chronologyStatus` 或 `confidenceNote` 中披露。

- [ ] **Step 4: 增加批次回归断言并生成数据**

在 `tests/data-integrity.test.ts` 中增加 6 个实体的 `expectWorldPolityDetails` 断言和上述 6 个年份的快照断言；同步把东南亚和中亚地区从 `none` 更新为 `sample`，并将 coverage 文案改为反映已经实际落地的条目。然后运行：

```bash
npm test -- --run tests/data-integrity.test.ts tests/data-artifacts.test.ts
npm run generate:data
```

Expected: 6 个详情文件生成，Schema 与语义校验通过，实体测试从“缺少 ID”推进到仅剩其他批次缺失。

- [ ] **Step 5: 提交亚洲东部批次**

```bash
git add src/data/source/entities/world/polity-goryeo.json src/data/source/entities/world/polity-tokugawa-shogunate.json src/data/source/entities/world/polity-khmer-empire.json src/data/source/entities/world/polity-majapahit.json src/data/source/entities/world/polity-kushan-empire.json src/data/source/entities/world/polity-timurid-empire.json src/data/source/sources/sources.json tests/data-integrity.test.ts
git commit -m "feat(history): 补充东亚东南亚中亚政权"
```

### Task 4: 加入南亚和西亚四个政权

**Files:**
- Create: `src/data/source/entities/world/polity-maurya-empire.json`
- Create: `src/data/source/entities/world/polity-mughal-empire.json`
- Create: `src/data/source/entities/world/polity-seljuk-empire.json`
- Create: `src/data/source/entities/world/polity-ottoman-empire.json`
- Modify: `src/data/source/regions/regions.json`
- Modify: `src/data/source/sources/sources.json`
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/overview-timeline.test.ts`

**Interfaces:**
- Consumes: Task 1 的 4 个实体 ID、Task 2 的 `region-south-asia` 和 `region-west-asia`。
- Produces: 4 个具备完整详情闭包的南亚/西亚政权；奥斯曼帝国可绑定 `region-west-asia` 与 `region-europe`，由全览分组逻辑只展示一次。

- [ ] **Step 1: 登记四个政权的概述和统治者来源**

在 `sources.json` 中新增以下稳定来源 ID，并为每条记录填写真实题名、出版方、URL 和访问日期：

```text
source-maurya-history              source-maurya-rulers
source-mughal-history              source-mughal-rulers
source-seljuk-history              source-seljuk-rulers
source-ottoman-history             source-ottoman-rulers
```

资料选择必须能解释孔雀帝国公元前年代、莫卧儿帝国的 1526—1857 常见口径、塞尔柱帝国与奥斯曼帝国的多阶段继承/分支问题；无法统一的早期年代使用 `circa` 或 `disputed`，不能硬填 `exact`。

- [ ] **Step 2: 创建四个实体分片并分配唯一顺序**

使用 `order` 840、850、860、870。孔雀帝国和莫卧儿帝国使用 `region-south-asia`；塞尔柱帝国使用 `region-west-asia`；奥斯曼帝国使用 `region-west-asia`、`region-europe`。所有实体保持世界样本的 `contemporary` 展示类别，并在简介中解释政权核心区域，不套用现代国界。

- [ ] **Step 3: 写入统治者任期并添加代表年份测试**

录入主要统治者、必要的共治/摄政/争位记录和来源。至少增加以下快照断言：孔雀帝国公元前 250 年、莫卧儿帝国 1605 年、塞尔柱帝国 1072 年、奥斯曼帝国 1453 年均可得到有来源的统治者结果；对孔雀帝国等年代争议记录，快照可为 `disputed`，但不能是无解释的 `unrecorded`。同步把南亚和西亚 coverage 文案更新为包含已经落地的新增政权，不提前写 Task 5–6 的政权。

- [ ] **Step 4: 更新跨地区全览测试并定向验证**

将 `tests/overview-timeline.test.ts` 中全球跨地区组的精确数组断言改成集合断言，至少包含拜占庭帝国、阿拔斯哈里发、贵霜帝国、帖木儿帝国和奥斯曼帝国；把欧洲单选测试从精确数组改成 `arrayContaining`，并把欧洲范围断言改成只锁定 `startYear: 330` 与 `endYear: 1922`，避免新增欧洲政权使测试依赖旧的固定成员。最后断言每个跨地区实体 ID 在所有分组中只出现一次。运行：

```bash
npm test -- --run tests/data-integrity.test.ts tests/data-artifacts.test.ts tests/overview-timeline.test.ts
npm run validate:data
```

- [ ] **Step 5: 提交南亚西亚批次**

```bash
git add src/data/source/entities/world/polity-maurya-empire.json src/data/source/entities/world/polity-mughal-empire.json src/data/source/entities/world/polity-seljuk-empire.json src/data/source/entities/world/polity-ottoman-empire.json src/data/source/sources/sources.json tests/data-integrity.test.ts tests/overview-timeline.test.ts
git commit -m "feat(history): 补充南亚西亚政权"
```

### Task 5: 加入欧洲和非洲四个政权

**Files:**
- Create: `src/data/source/entities/world/polity-frankish-kingdom.json`
- Create: `src/data/source/entities/world/polity-kingdom-of-england.json`
- Create: `src/data/source/entities/world/polity-fatimid-caliphate.json`
- Create: `src/data/source/entities/world/polity-mali-empire.json`
- Modify: `src/data/source/regions/regions.json`
- Modify: `src/data/source/sources/sources.json`
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/overview-timeline.test.ts`

**Interfaces:**
- Consumes: Task 1 的 4 个实体 ID、Task 2 的 `region-europe`、`region-north-africa` 和 `region-west-africa`。
- Produces: 欧洲与非洲新增条目，且西非拥有首批本地区政权，不再只有北非和跨地区样本。

- [ ] **Step 1: 登记欧洲和非洲来源**

在 `sources.json` 中新增：

```text
source-frankish-history           source-frankish-rulers
source-england-history            source-england-rulers
source-fatimid-history            source-fatimid-rulers
source-mali-history               source-mali-rulers
```

法兰克王国与英格兰王国的年代需明确展示口径；法蒂玛王朝需说明从伊夫里基叶/北非起家并以埃及为中心的阶段；马里帝国使用 `region-west-africa`，简介避免将帝国范围等同于现代国家边界。

- [ ] **Step 2: 创建四个实体和统治者分片**

使用 `order` 880、890、900、910。四个实体分别归入欧洲、欧洲、北非、西非；每个分片包含主要统治者、来源、任期和必要的年代说明。马里帝国早期年代使用 `circa` 或 `disputed` 时，必须同时提供 `chronologyNote` 或 `confidenceNote`。

- [ ] **Step 3: 增加代表年份和地区覆盖测试**

至少断言：法兰克王国 800 年、英格兰王国 1066 年、法蒂玛王朝 1000 年、马里帝国 1350 年均存在有来源的统治者快照；欧洲组同时包含新增欧洲条目，西非组能独立生成全览分组。

- [ ] **Step 4: 生成并验证本批次**

```bash
npm run validate:data
npm test -- --run tests/data-integrity.test.ts tests/data-artifacts.test.ts tests/overview-timeline.test.ts
```

Expected: 北非 coverage 文案不再声称“尚未形成北非本地政权序列”，西非选择器能显示“覆盖有限”，所有 4 个详情闭包可加载。

- [ ] **Step 5: 提交欧洲非洲批次**

```bash
git add src/data/source/entities/world/polity-frankish-kingdom.json src/data/source/entities/world/polity-kingdom-of-england.json src/data/source/entities/world/polity-fatimid-caliphate.json src/data/source/entities/world/polity-mali-empire.json src/data/source/sources/sources.json tests/data-integrity.test.ts tests/overview-timeline.test.ts
git commit -m "feat(history): 补充欧洲非洲政权"
```

### Task 6: 加入美洲两个政权并完成地区提示回归

**Files:**
- Create: `src/data/source/entities/world/polity-aztec-empire.json`
- Create: `src/data/source/entities/world/polity-inca-empire.json`
- Modify: `src/data/source/regions/regions.json`
- Modify: `src/data/source/sources/sources.json`
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/selectors.test.ts`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- Consumes: Task 1 的美洲 ID 和 Task 2 将 `region-americas` 设置为 `sample` 的结果。
- Produces: 美洲在全览中有两个可点击条目，在 1000 年时间点仍能明确显示“当前覆盖有限”，在存在年份显示政权和统治者。

- [ ] **Step 1: 登记来源并创建两个政权分片**

在 `sources.json` 中新增 `source-aztec-history`、`source-aztec-rulers`、`source-inca-history`、`source-inca-rulers`，使用 `order` 920 和 930。两个实体均绑定 `region-americas`，年代端点按历史常用口径记录，统治者的西语/纳瓦特尔语/克丘亚语名称通过 `aliases` 或 `localTitles` 保存，不把现代国家名写入实体主名。实体加入后将 `region-americas.coverage.status` 改为 `sample`，并写入只描述当前两个条目的覆盖说明。

- [ ] **Step 2: 写入主要统治者和美洲行为断言**

至少增加：阿兹特克帝国 1500 年、印加帝国 1500 年有已记录统治者；在 1000 年自选美洲时 `polityEmptyReason` 为 `limited-coverage`；在全览美洲范围可以找到两个实体；详情来源集合和人物集合均非空。

- [ ] **Step 3: 更新页面回归测试**

在 `tests/app.test.tsx` 中：

- 将 `/?scope=global` 的数量断言改为 `显示 93 / 93 个条目`；
- 将 `/?mode=point&year=1000&scope=custom&region=region-americas` 的空状态断言改为“当前数据覆盖有限，不表示当时不存在政权”；
- 将原来全览美洲“尚未收录”测试改为断言阿兹特克帝国和印加帝国按钮存在，且不出现“尚未收录代表性政权”。

- [ ] **Step 4: 运行美洲批次验证**

```bash
npm run validate:data
npm test -- --run tests/selectors.test.ts tests/app.test.tsx tests/data-integrity.test.ts tests/data-artifacts.test.ts
```

- [ ] **Step 5: 提交美洲批次**

```bash
git add src/data/source/entities/world/polity-aztec-empire.json src/data/source/entities/world/polity-inca-empire.json src/data/source/sources/sources.json tests/data-integrity.test.ts tests/selectors.test.ts tests/app.test.tsx
git commit -m "feat(history): 补充美洲政权样本"
```

### Task 7: 完成全量回归、覆盖文档和字体校验

**Files:**
- Modify: `tests/data-source.test.ts`
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/data-artifacts.test.ts`
- Modify: `tests/overview-timeline.test.ts`
- Modify: `tests/selectors.test.ts`
- Modify: `tests/app.test.tsx`
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `docs/data-contract.md`

**Interfaces:**
- Consumes: Task 2–6 的完整源数据和生成摘要。
- Produces: 文档、测试和实际数据统计一致的可交付状态。

- [ ] **Step 1: 将所有旧数量和旧覆盖描述改为真实当前数据**

保留中国全览的 73 个时间轴条目和 7 个阶段；将全球实体数更新为 93，将世界代表政权数更新为 20。人物数、任期数、来源数以 `npm run generate:data` 打印的实际摘要为准，复制到 `README.md`、`ROADMAP.md` 和 `docs/data-contract.md`，不得手工估算。删除“美洲尚未收录”“其他地区只有四个世界条目”等已过时描述，保留“全球已收录不代表完整世界史”的口径。

- [ ] **Step 2: 更新全览与选择器固定断言**

确认以下断言全部与新数据一致：

- `tests/overview-timeline.test.ts` 的中国组仍为 73 个、7 个阶段；
- 全球组为 93 个实体，所有跨地区实体各出现一次；
- `tests/selectors.test.ts` 的中国全览政权/历史分期数量不变；
- `tests/app.test.tsx` 的中国默认文案仍为 `73 / 73`，全球文案为 `93 / 93`；
- 新增地区可通过复选框和 URL `region=<id>` 恢复；
- 美洲在未命中年份时显示覆盖有限，不显示“尚未收录”。

- [ ] **Step 3: 运行完整验证命令并记录摘要**

```bash
npm run validate:data
npm test
npm run typecheck
npm run build
npm run check:fonts
```

Expected:

- 数据校验通过，实体为 93 个，详情包为 93 个；
- Vitest 全部通过；
- TypeScript 无错误；
- Vite 生产构建成功；
- 字体子集检查通过，新增中文名、本地名和文案无缺字。

- [ ] **Step 4: 检查生成文件和工作区边界**

运行 `git status --short`，确认没有把 `public/data/generated/`、`.generated/`、`.venv-fonts/` 或其他临时文件加入提交；运行 `git diff --check` 确认没有空白错误；逐个检查 16 个新实体文件名与实体 ID 完全一致。

- [ ] **Step 5: 提交文档和最终回归结果**

```bash
git add README.md ROADMAP.md docs/data-contract.md tests/data-source.test.ts tests/data-integrity.test.ts tests/data-artifacts.test.ts tests/overview-timeline.test.ts tests/selectors.test.ts tests/app.test.tsx
git commit -m "docs(history): 更新全球政权覆盖说明"
```

## 计划自审

- 设计文档中的 16 个政权全部在 Task 1 ID 常量和 Task 3–6 数据任务中出现。
- 三个新增地区在 Task 2 创建，并在 Task 1、Task 5 和 Task 6 的真实数据/页面测试中覆盖。
- 统治者、来源、详情闭包、跨地区去重、地区覆盖提示、URL 恢复、字体和最终质量命令均有对应任务。
- 没有引入新的加载器、Schema 版本或 React 结构；生成器会递归加载 `world/` 下新增分片。
- 计划中没有未决或空缺步骤，也没有未定义的函数名；所有测试引用的辅助函数均已存在于当前代码库或在任务中给出定义方式。
