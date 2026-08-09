# World Polity Details Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有拜占庭帝国、阿拔斯哈里发、神圣罗马帝国和朱罗帝国补齐详细简介、完整正式统治者序列、必要的特殊统治角色与可追溯来源。

**Architecture:** 保持 Crownline schema v3、数据分片、生成器和详情懒加载链路不变，逐政权扩充独立 JSON 分片并在集中来源表登记引用。每个政权先建立失败的数据完整性与代表年份断言，再录入人物和任期并运行独立验证；最后统一更新地区覆盖说明与项目文档。

**Tech Stack:** JSON、TypeScript 7、Vitest 4、Ajv 8、现有 Vite 数据生成器。

## Global Constraints

- 目标严格限定为现有 `polity-byzantine-empire`、`polity-abbasid-caliphate`、`polity-holy-roman-empire` 和 `polity-chola-empire`，不新增政权实体。
- 每个简介目标为 100 至 200 个中文字符，至少覆盖形成背景、统治中心或主要范围、关键演变和终结方式。
- 完整收录设计范围内的正式统治者，并补充有可靠来源的重要共治者、摄政者和主要争位者。
- 每个政权沿革和每条任期必须绑定可追溯来源；三级来源可辅助核对常规姓名和序列，但不能单独支撑争议结论。
- 任期两端均包含；每段任期必须完整落在所属政权的一个存在区间内。同年交替可以让多位统治者同时命中。
- 不确定年份使用 `circa` 或 `unknown` 及必要说明，不制造虚假精度。
- 只在来源明确支持时写入 `reignVacancies`，不得从普通任期资料缺口推导空位。
- 沿用现有年代范围：拜占庭约 330—1453、阿拔斯巴格达时期 750—1258、神圣罗马 962—1806、朱罗中世纪帝国阶段约 850—1279。
- 不修改 JSON Schema、共享 TypeScript 类型、生成器、页面组件、关系、事件或地图数据；需要突破边界时停止并请求授权。
- 每个政权完成并验证后再进入下一个；一般年代分歧记录在说明字段中，只有设计规定的真实阻塞条件才暂停。

---

## File Structure

- `src/data/source/entities/world/polity-byzantine-empire.json`：拜占庭帝国简介、人物、任期及必要的争议说明。
- `src/data/source/entities/world/polity-abbasid-caliphate.json`：阿拔斯巴格达时期简介、人物、任期及必要的争议说明。
- `src/data/source/entities/world/polity-holy-roman-empire.json`：962—1806 年统治序列、称号差异和主要对立国王。
- `src/data/source/entities/world/polity-chola-empire.json`：约 850—1279 年中世纪朱罗统治序列和年代说明。
- `src/data/source/sources/sources.json`：新增四个统治者序列来源；争议记录必须另有机构或学术来源支持。
- `src/data/source/regions/regions.json`：保持外部地区 `sample` 覆盖等级，改写“机制样本”文案以反映详情已深化但广度有限。
- `tests/data-integrity.test.ts`：保存世界政权详情断言、最低任期数量和代表年份快照。
- `tests/data-artifacts.test.ts`：证明四个世界政权详情包包含且只包含相关人物、任期和来源闭包。
- `README.md`：更新其他地区政权详情和统治者覆盖说明。
- `ROADMAP.md`：记录阶段 3 已扩展至四个世界政权，但不改变阶段 4 关系功能状态。
- `docs/data-contract.md`：同步 schema v3 的实际人物与任期覆盖范围。

### Task 1: 补全拜占庭帝国详情

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/data-artifacts.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/world/polity-byzantine-empire.json`

**Interfaces:**
- Consumes: `loadSourceData()`、`buildGeneratedArtifacts()`、现有 `rulerSnapshot(entityId, year)` 测试辅助函数，以及 schema v3 的 `Person`、`Reign` 与 `Source` 结构。
- Produces: `expectWorldPolityDetails(entityId, minimumReignCount)` 测试辅助函数、拜占庭人物／任期数据和首个世界政权详情闭包断言。

- [ ] **Step 1: 写拜占庭失败测试和可复用详情断言**

在 `tests/data-integrity.test.ts` 的现有辅助函数旁加入：

```ts
function expectWorldPolityDetails(entityId: string, minimumReignCount: number) {
  const entity = data.entities.find(({ id }) => id === entityId);
  const reigns = data.reigns.filter(({ polityId }) => polityId === entityId);

  expect(entity, entityId).toBeDefined();
  expect(entity?.description.length, entityId).toBeGreaterThanOrEqual(60);
  expect(entity?.sourceRefs.length, entityId).toBeGreaterThan(0);
  expect(reigns.length, entityId).toBeGreaterThanOrEqual(minimumReignCount);
  expect(reigns.every(({ sourceRefs }) => sourceRefs.length > 0), entityId).toBe(true);
}
```

新增拜占庭测试；人物 ID 是本任务必须采用的稳定 ID：

```ts
it("补全拜占庭帝国详情与统治者", () => {
  expectWorldPolityDetails("polity-byzantine-empire", 80);

  const year1000 = rulerSnapshot("polity-byzantine-empire", 1000);
  expect(year1000.status).toBe("known");
  expect(year1000.entries.map(({ person }) => person.id)).toEqual(expect.arrayContaining([
    "person-byzantine-basil-ii",
    "person-byzantine-constantine-viii"
  ]));

  expect(rulerSnapshot("polity-byzantine-empire", 1220).status).toBe("known");
  expect(rulerSnapshot("polity-byzantine-empire", 1453).entries.map(({ person }) => person.id))
    .toContain("person-byzantine-constantine-xi");
});
```

- [ ] **Step 2: 运行测试并确认当前数据缺失**

Run: `npx vitest run tests/data-integrity.test.ts -t "补全拜占庭帝国"`

Expected: FAIL，失败点为拜占庭任期数量为 0，不能先通过降低最低数量消除失败。

- [ ] **Step 3: 登记统治序列来源并核对争议边界**

在 `sources.json` 增加下列序列核对来源；现有 `source-met-byzantium` 继续支持政权沿革和约 330—1453 年口径：

```json
{
  "id": "source-wikipedia-byzantine-emperors",
  "title": "List of Byzantine emperors",
  "sourceType": "tertiary",
  "citation": "Wikipedia contributors: List of Byzantine emperors；用于交叉核对皇帝姓名、称号、共治关系与任期区间。",
  "publisher": "Wikimedia Foundation",
  "url": "https://en.wikipedia.org/wiki/List_of_Byzantine_emperors",
  "accessedAt": "2026-08-09"
}
```

逐项核对 330 年前已即位者的任期截断、1204—1261 年尼西亚继承口径、共治皇帝、废黜与复位。任何标记为 `disputed` 的记录必须同时引用 `source-met-byzantium` 或实施时核实到的机构／学术来源；若找不到此类来源，按设计第 8 节上报阻塞。

- [ ] **Step 4: 扩写简介并录入人物与任期**

在 `polity-byzantine-empire.json` 中：

- 将简介扩写到目标深度，覆盖东罗马延续、君士坦丁堡、1204 年中断首都控制但由尼西亚延续、1261 年恢复和 1453 年终结；
- 人物 ID 使用 `person-byzantine-` 加小写 ASCII 拉丁名，例如 `person-byzantine-alexios-i-komnenos`；任期 ID 使用相同尾部并改用 `reign-byzantine-` 前缀；复位人物只创建一条 `Person` 和一条含多个 `periods` 的 `Reign`；
- 君士坦丁一世任期从现有政权起点 330 年开始，不把 306—329 年写入本政权任期；
- 主要皇帝使用 `role: "ruler"`，同一时期的次要共治皇帝使用 `role: "co-ruler"`，正式摄政者使用 `role: "regent"`，主要争位者使用 `role: "contender"`；
- 同一人物由共治者转为主要皇帝时保留一条 `Person`，按角色拆为两条 `Reign`，任期 ID 分别追加 `-co-ruler` 和 `-ruler`；转折年份允许两条闭区间同时命中，并在任期 `note` 中解释角色转换；
- 为本任务测试固定使用 `person-byzantine-basil-ii`、`person-byzantine-constantine-viii`、`person-byzantine-constantine-xi`。

常规任期至少包含以下字段，不得省略置信度或来源：

```json
{
  "id": "reign-byzantine-basil-ii",
  "personId": "person-byzantine-basil-ii",
  "polityId": "polity-byzantine-empire",
  "titles": ["皇帝"],
  "localTitles": ["βασιλεύς"],
  "role": "ruler",
  "periods": [{
    "start": { "year": 976, "precision": "exact" },
    "end": { "year": 1025, "precision": "exact" }
  }],
  "chronologyStatus": "accepted",
  "sourceRefs": [{ "sourceId": "source-wikipedia-byzantine-emperors" }],
  "confidence": "medium"
}
```

- [ ] **Step 5: 运行拜占庭结构与领域验证**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts`

Expected: PASS；1220 年必须命中尼西亚继承序列，所有任期必须位于 330—1453 年内。

- [ ] **Step 6: 增加拜占庭详情包闭包断言**

在 `tests/data-artifacts.test.ts` 加入：

```ts
it("为拜占庭帝国生成独立详情闭包", () => {
  const detail = buildGeneratedArtifacts(data).details.get("polity-byzantine-empire");

  expect(detail?.persons.length).toBeGreaterThanOrEqual(80);
  expect(detail?.reigns.every(({ polityId }) => polityId === "polity-byzantine-empire"))
    .toBe(true);
  expect(new Set(detail?.persons.map(({ id }) => id)))
    .toEqual(new Set(detail?.reigns.map(({ personId }) => personId)));
  expect(detail?.sources.map(({ id }) => id)).toEqual(expect.arrayContaining([
    "source-met-byzantium",
    "source-wikipedia-byzantine-emperors"
  ]));
});
```

- [ ] **Step 7: 运行首批完整定向测试**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS。

- [ ] **Step 8: 提交拜占庭数据**

```bash
git add src/data/source/entities/world/polity-byzantine-empire.json src/data/source/sources/sources.json tests/data-integrity.test.ts tests/data-artifacts.test.ts
git commit -m "feat(history): 补全拜占庭帝国详情"
```

### Task 2: 补全阿拔斯哈里发详情

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/world/polity-abbasid-caliphate.json`

**Interfaces:**
- Consumes: Task 1 的 `expectWorldPolityDetails()`、既有 `source-met-abbasid` 与通过验证的世界政权数据基线。
- Produces: 750—1258 年巴格达时期阿拔斯哈里发人物、任期和来源闭包。

- [ ] **Step 1: 写阿拔斯失败测试**

```ts
it("补全阿拔斯哈里发详情与统治者", () => {
  expectWorldPolityDetails("polity-abbasid-caliphate", 37);
  expect(rulerSnapshot("polity-abbasid-caliphate", 800).entries.map(({ person }) => person.id))
    .toContain("person-abbasid-harun-al-rashid");
  expect(rulerSnapshot("polity-abbasid-caliphate", 1258).entries.map(({ person }) => person.id))
    .toContain("person-abbasid-al-mustasim");
});
```

- [ ] **Step 2: 运行测试并确认当前数据缺失**

Run: `npx vitest run tests/data-integrity.test.ts -t "补全阿拔斯哈里发"`

Expected: FAIL，失败点为阿拔斯任期数量为 0。

- [ ] **Step 3: 登记统治序列来源**

在 `sources.json` 增加：

```json
{
  "id": "source-wikipedia-abbasid-caliphs",
  "title": "List of Abbasid caliphs",
  "sourceType": "tertiary",
  "citation": "Wikipedia contributors: List of Abbasid caliphs；用于交叉核对巴格达时期哈里发姓名、称号与任期区间。",
  "publisher": "Wikimedia Foundation",
  "url": "https://en.wikipedia.org/wiki/List_of_Abbasid_caliphs",
  "accessedAt": "2026-08-09"
}
```

现有 `source-met-abbasid` 继续支持 750—1258 年政权沿革和巴格达时期边界。来源核对必须排除 1261 年后的开罗阿拔斯世系；任何实质争议另引机构或学术来源。

- [ ] **Step 4: 扩写简介并录入 37 位巴格达时期哈里发**

在 `polity-abbasid-caliphate.json` 中：

- 扩写建立、迁都巴格达、政治权力被军人集团和地方王朝削弱、文化宗教中心地位及 1258 年蒙古攻陷巴格达的终结；
- 人物 ID 使用 `person-abbasid-` 加小写 ASCII 尊号，例如 `person-abbasid-al-mamun`；任期 ID 使用相同尾部并改用 `reign-abbasid-` 前缀；
- 正式哈里发使用 `role: "ruler"`，布韦希埃米尔和塞尔柱苏丹不得写成阿拔斯 `ruler` 或 `regent`；
- 固定使用 `person-abbasid-harun-al-rashid` 和 `person-abbasid-al-mustasim` 以满足代表年份测试；
- 只录入 750—1258 年巴格达序列，不创建开罗时期人物。

- [ ] **Step 5: 校验阿拔斯数据与前批回归**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS；750 与 1258 两个闭区间端点均有正式哈里发，拜占庭测试继续通过。

- [ ] **Step 6: 提交阿拔斯数据**

```bash
git add src/data/source/entities/world/polity-abbasid-caliphate.json src/data/source/sources/sources.json tests/data-integrity.test.ts
git commit -m "feat(history): 补全阿拔斯哈里发详情"
```

### Task 3: 补全神圣罗马帝国详情

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/world/polity-holy-roman-empire.json`

**Interfaces:**
- Consumes: `expectWorldPolityDetails()`、现有 `source-dhm-hre`、`source-met-hre` 与前两批通过的数据基线。
- Produces: 962—1806 年罗马人的国王／皇帝统治序列、称号差异和来源闭包。

- [ ] **Step 1: 写神圣罗马失败测试**

```ts
it("补全神圣罗马帝国详情与统治者", () => {
  expectWorldPolityDetails("polity-holy-roman-empire", 45);
  expect(rulerSnapshot("polity-holy-roman-empire", 1000).entries.map(({ person }) => person.id))
    .toContain("person-hre-otto-iii");
  expect(rulerSnapshot("polity-holy-roman-empire", 1700).entries.map(({ person }) => person.id))
    .toContain("person-hre-leopold-i");
  expect(rulerSnapshot("polity-holy-roman-empire", 1806).entries.map(({ person }) => person.id))
    .toContain("person-hre-francis-ii");
});
```

- [ ] **Step 2: 运行测试并确认当前数据缺失**

Run: `npx vitest run tests/data-integrity.test.ts -t "补全神圣罗马帝国"`

Expected: FAIL，失败点为神圣罗马任期数量为 0。

- [ ] **Step 3: 登记统治序列来源并核对称号**

在 `sources.json` 增加：

```json
{
  "id": "source-wikipedia-holy-roman-emperors",
  "title": "List of Holy Roman emperors",
  "sourceType": "tertiary",
  "citation": "Wikipedia contributors: List of Holy Roman emperors；用于交叉核对罗马人的国王、皇帝、对立国王与任期区间。",
  "publisher": "Wikimedia Foundation",
  "url": "https://en.wikipedia.org/wiki/List_of_Holy_Roman_emperors",
  "accessedAt": "2026-08-09"
}
```

`source-dhm-hre` 支持 962—1806 年采用口径，`source-met-hre` 支持从 800 年追溯传统的替代口径。对大空位、双重选举和对立国王身份的争议不得只引用三级来源。

- [ ] **Step 4: 扩写简介并录入正式统治序列**

在 `polity-holy-roman-empire.json` 中：

- 扩写奥托一世加冕、选举君主制与复合政治结构、教皇加冕传统变化、哈布斯堡长期统治和 1806 年解体；
- 人物 ID 使用 `person-hre-` 加小写 ASCII 拉丁名和序号，例如 `person-hre-frederick-ii`；任期 ID 使用相同尾部并改用 `reign-hre-` 前缀；
- 962 年从奥托一世开始，800—961 年人物只保留在替代年代说明中，不创建本政权任期；
- 已当选并实际作为罗马人的国王统治、但未获皇帝加冕者仍使用 `role: "ruler"`，`titles` 精确写为“罗马人的国王”或“神圣罗马皇帝”；
- 对立国王只在来源确认其具有显著政治影响时使用 `role: "contender"`；没有在位者的“大空位”不得自动写成 `reignVacancies`；
- 固定使用 `person-hre-otto-iii`、`person-hre-leopold-i`、`person-hre-francis-ii`。

- [ ] **Step 5: 校验神圣罗马数据与前批回归**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS；962 与 1806 年均有统治者，800 年仍只属于替代年代口径，前两批测试继续通过。

- [ ] **Step 6: 提交神圣罗马数据**

```bash
git add src/data/source/entities/world/polity-holy-roman-empire.json src/data/source/sources/sources.json tests/data-integrity.test.ts
git commit -m "feat(history): 补全神圣罗马帝国详情"
```

### Task 4: 补全朱罗帝国详情

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/world/polity-chola-empire.json`

**Interfaces:**
- Consumes: `expectWorldPolityDetails()`、现有 `source-inflibnet-chola` 与前三批通过的数据基线。
- Produces: 约 850—1279 年中世纪朱罗人物、任期、共治说明和来源闭包。

- [ ] **Step 1: 写朱罗失败测试**

```ts
it("补全朱罗帝国详情与统治者", () => {
  expectWorldPolityDetails("polity-chola-empire", 20);
  expect(rulerSnapshot("polity-chola-empire", 1010).entries.map(({ person }) => person.id))
    .toContain("person-chola-rajaraja-i");
  expect(rulerSnapshot("polity-chola-empire", 1070).entries.map(({ person }) => person.id))
    .toContain("person-chola-kulottunga-i");
  expect(rulerSnapshot("polity-chola-empire", 1279).entries.map(({ person }) => person.id))
    .toContain("person-chola-rajendra-iii");
});
```

- [ ] **Step 2: 运行测试并确认当前数据缺失**

Run: `npx vitest run tests/data-integrity.test.ts -t "补全朱罗帝国"`

Expected: FAIL，失败点为朱罗任期数量为 0。

- [ ] **Step 3: 登记统治序列来源并核对中世纪边界**

在 `sources.json` 增加辅助序列来源：

```json
{
  "id": "source-wikipedia-chola-emperors",
  "title": "List of Chola emperors",
  "sourceType": "tertiary",
  "citation": "Wikipedia contributors: List of Chola emperors；用于交叉核对中世纪朱罗统治者姓名、共治关系与任期区间。",
  "publisher": "Wikimedia Foundation",
  "url": "https://en.wikipedia.org/wiki/List_of_Chola_emperors",
  "accessedAt": "2026-08-09"
}
```

现有 `source-inflibnet-chola` 继续作为沿革、约 850 年起点和统治序列的机构来源。实施前核对上述辅助页面能够直接访问；若标题或规范 URL 已变化，只允许修正该来源记录，不改变稳定业务 ID。

- [ ] **Step 4: 扩写简介并录入中世纪朱罗序列**

在 `polity-chola-empire.json` 中：

- 扩写维查耶罗耶复兴、泰米尔地区核心、罗阇罗阇一世与罗阇因陀罗一世时期扩张、海上联系、后期衰落及 1279 年终结；
- 人物 ID 使用 `person-chola-` 加小写 ASCII 拉丁转写和序号，例如 `person-chola-rajendra-ii`；任期 ID 使用相同尾部并改用 `reign-chola-` 前缀；
- 850 年前人物不并入当前政权，维查耶罗耶的起点使用与实体一致的 `circa` 精度；
- 只有来源明确支持实际共同统治时才使用 `role: "co-ruler"`；王储身份本身不等于共治；
- 晚期序列的实质年代差异使用 `chronologyStatus: "disputed"` 或降低 `confidence` 并写明采用口径；
- 固定使用 `person-chola-rajaraja-i`、`person-chola-kulottunga-i`、`person-chola-rajendra-iii`。

- [ ] **Step 5: 校验朱罗数据与全部政权回归**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS；约 850 与 1279 年边界符合现有实体口径，前三个世界政权及全部中国政权断言继续通过。

- [ ] **Step 6: 提交朱罗数据**

```bash
git add src/data/source/entities/world/polity-chola-empire.json src/data/source/sources/sources.json tests/data-integrity.test.ts
git commit -m "feat(history): 补全朱罗帝国详情"
```

### Task 5: 完成世界详情闭包、地区覆盖与文档收尾

**Files:**
- Modify: `tests/data-artifacts.test.ts`
- Modify: `src/data/source/regions/regions.json`
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `docs/data-contract.md`

**Interfaces:**
- Consumes: Tasks 1—4 的四个世界政权详情数据、`buildGeneratedArtifacts(data).details` 和现有地区覆盖模型。
- Produces: 四个世界政权的统一详情闭包回归测试、准确的覆盖说明和项目文档。

- [ ] **Step 1: 将详情闭包测试扩展到四个政权**

保留 Task 1 的拜占庭专门断言，并新增统一测试：

```ts
it("为四个世界政权生成可独立加载的详情闭包", () => {
  for (const entityId of [
    "polity-byzantine-empire",
    "polity-abbasid-caliphate",
    "polity-holy-roman-empire",
    "polity-chola-empire"
  ]) {
    const detail = buildGeneratedArtifacts(data).details.get(entityId);
    expect(detail?.persons.length, entityId).toBeGreaterThan(0);
    expect(detail?.reigns.length, entityId).toBeGreaterThan(0);
    expect(detail?.reigns.every(({ polityId }) => polityId === entityId), entityId).toBe(true);
    expect(new Set(detail?.persons.map(({ id }) => id)), entityId)
      .toEqual(new Set(detail?.reigns.map(({ personId }) => personId)));
    expect(detail?.sources.length, entityId).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: 运行闭包测试**

Run: `npx vitest run tests/data-artifacts.test.ts`

Expected: PASS；任一详情包都不得携带其他三个政权的任期或无关人物。

- [ ] **Step 3: 更新四个外部地区覆盖说明**

保持 `region-europe`、`region-west-asia`、`region-south-asia`、`region-north-africa` 的 `coverage.status: "sample"`，只改写 note：

- 欧洲：已收录具备统治者详情的拜占庭帝国和神圣罗马帝国，仍不足以代表欧洲通史；
- 西亚：已收录具备统治者详情的拜占庭帝国和阿拔斯哈里发，仍为有限样本；
- 南亚：已收录具备统治者详情的朱罗帝国，仍为单一代表条目；
- 北非：仅通过跨地区的阿拔斯哈里发覆盖，未形成北非本地政权序列。

不得把任何地区升级为 `partial`，也不得使用“完整覆盖”措辞。

- [ ] **Step 4: 计算最终数据数量并同步文档**

先运行以下只读统计命令：

```bash
node --import tsx -e 'import { loadSourceData } from "./scripts/data-source.ts"; (async () => { const data = await loadSourceData(); const world = new Set(["polity-byzantine-empire", "polity-abbasid-caliphate", "polity-holy-roman-empire", "polity-chola-empire"]); console.log(JSON.stringify({ persons: data.persons.length, reigns: data.reigns.length, worldPersons: data.persons.filter((person) => data.reigns.some((reign) => reign.personId === person.id && world.has(reign.polityId))).length, worldReigns: data.reigns.filter((reign) => world.has(reign.polityId)).length }, null, 2)); })();'
```

使用命令输出的确切数字更新：

- `README.md` 当前功能、数据维护和发展路线段落；
- `ROADMAP.md` 阶段 3 完成记录，说明详情覆盖从 71 个中国政权扩展到四个世界政权；
- `docs/data-contract.md` 第 5 节人物与任期覆盖说明。

文档必须继续说明全球内容覆盖有限，不得把四个条目表述为完整世界史。

- [ ] **Step 5: 运行数据、闭包和字体定向验证**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts && npm run check:fonts`

Expected: PASS；新增中文名称和文案均包含在站内字体子集中。若仅字体检查失败，运行 `npm run regen:fonts` 后重新执行 `npm run check:fonts`，并把实际变更的字体文件纳入本任务提交。

- [ ] **Step 6: 提交覆盖说明与文档**

```bash
git add src/data/source/regions/regions.json tests/data-artifacts.test.ts README.md ROADMAP.md docs/data-contract.md src/assets/fonts
git commit -m "docs(history): 更新世界政权详情覆盖说明"
```

### Task 6: 运行最终质量门禁并审查交付范围

**Files:**
- Verify only: `src/data/source/entities/world/*.json`
- Verify only: `src/data/source/sources/sources.json`
- Verify only: `src/data/source/regions/regions.json`
- Verify only: `tests/data-integrity.test.ts`
- Verify only: `tests/data-artifacts.test.ts`
- Verify only: `README.md`
- Verify only: `ROADMAP.md`
- Verify only: `docs/data-contract.md`

**Interfaces:**
- Consumes: Tasks 1—5 的已提交数据、测试和文档。
- Produces: 可追溯的最终验证证据，以及在没有越界修改时可交付的工作树。

- [ ] **Step 1: 运行完整自动化门禁**

```bash
npm run validate:data
npm test
npm run typecheck
npm run check:fonts
npm run build
git diff --check
```

Expected: 所有命令退出码均为 0。`npm test` 必须包含中国 71 个政权和四个世界政权的回归断言；`npm run build` 必须成功生成生产包。

- [ ] **Step 2: 审查来源和统治序列完整性**

逐个政权把 JSON 中的 `role: "ruler"`／`role: "co-ruler"` 序列与本计划登记的统治序列来源逐项对照，确认：

- 设计范围内没有无说明遗漏；
- 复位人物没有重复 `Person`；
- 任期没有跨过政权存在区间；
- 三级来源没有单独支撑 `disputed` 记录；
- 阿拔斯没有混入开罗世系，神圣罗马没有混入 800—961 年人物，朱罗没有混入约 850 年以前人物，拜占庭 1204—1261 年按尼西亚继承口径表达。

- [ ] **Step 3: 审查变更范围与提交历史**

Run: `git status --short && git diff --stat HEAD~5..HEAD && git log -6 --oneline`

Expected: 仅出现本计划列出的数据、测试、文档和必要字体文件；五个实施提交分别对应四个政权与一次文档收尾，不包含 schema、共享类型、页面组件、关系、事件或地图改动。

- [ ] **Step 4: 仅在修复最终审查问题时创建收尾提交**

若 Step 1—3 发现问题，先做最小范围修复并重跑受影响命令，再提交：

用 `git status --short` 列出本轮实际修复文件，逐个以完整路径暂存；确认暂存区不含范围外文件后执行：

```bash
git diff --cached --check
git commit -m "fix(history): 修正世界政权详情校订问题"
```

若没有修复，不创建空提交。
