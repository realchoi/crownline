# Chinese Non-Mainline Polity Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 55 个非主线中国政权补齐简介、人物、统治任期、争议说明与可追溯来源，使 71 个中国政权均具备已整理的统治者详情。

**Architecture:** 保持 Crownline schema v3 与现有详情懒加载架构不变，直接扩充各政权的独立 JSON 分片和集中来源表。按五个历史时期纵向批次执行，每批用数据完整性测试、全量语义校验和详情产物闭包验证形成可回归基线。

**Tech Stack:** JSON、TypeScript 7、Vitest 4、Ajv 8、现有 Vite 数据生成器。

## Global Constraints

- 目标限定为设计文档列出的现有 55 个非主线中国政权，不新增时间轴实体。
- 每个简介目标为 100 至 200 个中文字符，至少覆盖建立背景、统治核心或主要疆域、关键演变和终结方式。
- 收录正式在位君主，并补充重要摄政者、共治者和主要争位者；不把未实际控制政权的自称者混入正式序列。
- 每个政权的沿革和每条任期必须绑定可追溯来源；优先政府、博物馆、高校、学术机构和权威工具书公开页面。
- 不确定年份使用现有精度、置信度与说明字段，不伪装成精确纪年。
- 不修改 schema、共享类型、页面组件、关系或事件数据；如确有必要，停止并请求授权。
- 任期两端为闭区间，且每段任期必须完整落在所属政权的一个存在区间内。
- 每批完成并验证后直接进入下一批，不等待额外确认；只在设计规定的真实阻塞条件下暂停。

---

## File Structure

- `src/data/source/entities/china/*.json`：每个目标政权的简介、人物、任期与可选空位记录；每个文件仍只拥有一个主实体。
- `src/data/source/sources/sources.json`：新增按时期复用的机构、学术、权威工具书或可靠年表来源。
- `tests/data-integrity.test.ts`：保存五批目标 ID、通用完整性断言和各时期代表年份快照。
- `tests/data-artifacts.test.ts`：证明新政权详情包包含人物、任期和来源闭包。
- `README.md`：更新中国统治者数据覆盖数量和维护说明。
- `ROADMAP.md`：记录 55 个非主线政权详情补全结果，但不改变阶段 4 关系功能状态。
- `docs/data-contract.md`：补充 v3 数据覆盖从主线扩展到全部已收录中国政权的说明。

### Task 1: 建立分批完整性门禁并完成汉与三国 4 个政权

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/data-artifacts.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/china/polity-cn-xin.json`
- Modify: `src/data/source/entities/china/polity-cn-cao-wei.json`
- Modify: `src/data/source/entities/china/polity-cn-shu-han.json`
- Modify: `src/data/source/entities/china/polity-cn-eastern-wu.json`

**Interfaces:**
- Consumes: `loadSourceData()`, `buildGeneratedArtifacts()`, `selectRulerSnapshot()` 和 schema v3 的 `Person`、`Reign`、`Source` 结构。
- Produces: `NON_MAINLINE_POLITY_BATCHES` 测试常量、可复用的批次完整性断言，以及首批 4 个政权的完整详情数据。

- [ ] **Step 1: 写首批失败测试和可复用目标集合**

在 `tests/data-integrity.test.ts` 顶层加入：

```ts
const NON_MAINLINE_POLITY_BATCHES = {
  hanThreeKingdoms: [
    "polity-cn-xin",
    "polity-cn-cao-wei",
    "polity-cn-shu-han",
    "polity-cn-eastern-wu"
  ],
  sixteenKingdoms: [
    "polity-cn-former-liang", "polity-cn-cheng-han", "polity-cn-han-zhao",
    "polity-cn-later-zhao", "polity-cn-former-yan", "polity-cn-former-qin",
    "polity-cn-later-qin", "polity-cn-later-yan", "polity-cn-western-qin",
    "polity-cn-later-liang-lu", "polity-cn-southern-liang-tufa",
    "polity-cn-northern-liang", "polity-cn-southern-yan", "polity-cn-western-liang",
    "polity-cn-hu-xia", "polity-cn-northern-yan"
  ],
  northernSouthernDynasties: [
    "polity-cn-northern-wei", "polity-cn-eastern-wei", "polity-cn-western-wei",
    "polity-cn-northern-qi", "polity-cn-northern-zhou", "polity-cn-liu-song",
    "polity-cn-southern-qi", "polity-cn-liang", "polity-cn-chen"
  ],
  suiTangFiveDynasties: [
    "polity-cn-wu-zhou", "polity-cn-later-liang-zhu", "polity-cn-later-tang",
    "polity-cn-later-jin", "polity-cn-later-han", "polity-cn-later-zhou",
    "polity-cn-yang-wu", "polity-cn-southern-tang", "polity-cn-wuyue",
    "polity-cn-min", "polity-cn-ma-chu", "polity-cn-former-shu",
    "polity-cn-later-shu", "polity-cn-southern-han", "polity-cn-jingnan",
    "polity-cn-northern-han", "polity-tibet-empire", "polity-balhae", "polity-nanzhao"
  ],
  laterPolities: [
    "polity-cn-liao", "polity-dali", "polity-cn-western-xia", "polity-cn-jin",
    "polity-mongol-empire", "polity-cn-later-jin-jurchen", "polity-cn-southern-ming"
  ]
} as const;

function expectPolityDetails(entityIds: readonly string[]) {
  for (const entityId of entityIds) {
    const entity = data.entities.find(({ id }) => id === entityId);
    expect(entity, entityId).toBeDefined();
    expect(entity?.description.length, entityId).toBeGreaterThanOrEqual(60);
    expect(entity?.sourceRefs.length, entityId).toBeGreaterThan(0);
    expect(data.reigns.some(({ polityId }) => polityId === entityId), entityId).toBe(true);
  }
}
```

新增首批测试：

```ts
it("补全汉与三国四个非主线政权的详情", () => {
  expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.hanThreeKingdoms);
  expect(rulerSnapshot("polity-cn-xin", 15).status).toBe("known");
  expect(rulerSnapshot("polity-cn-cao-wei", 240).status).toBe("known");
  expect(rulerSnapshot("polity-cn-shu-han", 250).status).toBe("known");
  expect(rulerSnapshot("polity-cn-eastern-wu", 252).status).toBe("known");
});
```

- [ ] **Step 2: 运行测试并确认数据缺失失败**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL，首个失败应指出 `polity-cn-xin` 简介过短或缺少任期。

- [ ] **Step 3: 检索并登记汉与三国来源**

核对来源页面的发布机构、标题、URL、访问日期和具体支持范围；在 `sources.json` 新增稳定 ID。来源至少覆盖王莽新朝沿革和曹魏、蜀汉、孙吴君主序列，不能只引用搜索结果页。访问日期使用 `2026-08-07`。

- [ ] **Step 4: 录入首批简介、人物与任期**

逐文件扩写 `description`，并为王莽、曹魏五帝、蜀汉二帝、孙吴正式君主及需要标注的摄政或争位者录入 `persons` 和 `reigns`。所有 ID 使用 `person-cn-<polity-token>-<name-token>` 与 `reign-cn-<polity-token>-<name-token>`；同一人物的多段任期放入同一 `periods` 数组。

- [ ] **Step 5: 校验首批并修正具体数据问题**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts`

Expected: PASS；不得通过放宽校验、删除争议记录或扩大政权存在区间掩盖问题。

- [ ] **Step 6: 为新政权详情包补充闭包断言**

在 `tests/data-artifacts.test.ts` 增加：

```ts
it("为新增非主线政权生成可独立加载的详情闭包", () => {
  const wei = buildGeneratedArtifacts(data).details.get("polity-cn-cao-wei");
  expect(wei?.persons.length).toBeGreaterThan(0);
  expect(wei?.reigns.every(({ polityId }) => polityId === "polity-cn-cao-wei")).toBe(true);
  expect(wei?.sources.length).toBeGreaterThan(0);
});
```

- [ ] **Step 7: 运行首批完整定向测试**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS。

- [ ] **Step 8: 提交首批数据**

```bash
git add src/data/source/sources/sources.json src/data/source/entities/china/polity-cn-xin.json src/data/source/entities/china/polity-cn-cao-wei.json src/data/source/entities/china/polity-cn-shu-han.json src/data/source/entities/china/polity-cn-eastern-wu.json tests/data-integrity.test.ts tests/data-artifacts.test.ts
git commit -m "feat(history): 补全汉与三国政权详情"
```

### Task 2: 完成两晋与十六国 16 个政权

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/china/polity-cn-former-liang.json`
- Modify: `src/data/source/entities/china/polity-cn-cheng-han.json`
- Modify: `src/data/source/entities/china/polity-cn-han-zhao.json`
- Modify: `src/data/source/entities/china/polity-cn-later-zhao.json`
- Modify: `src/data/source/entities/china/polity-cn-former-yan.json`
- Modify: `src/data/source/entities/china/polity-cn-former-qin.json`
- Modify: `src/data/source/entities/china/polity-cn-later-qin.json`
- Modify: `src/data/source/entities/china/polity-cn-later-yan.json`
- Modify: `src/data/source/entities/china/polity-cn-western-qin.json`
- Modify: `src/data/source/entities/china/polity-cn-later-liang-lu.json`
- Modify: `src/data/source/entities/china/polity-cn-southern-liang-tufa.json`
- Modify: `src/data/source/entities/china/polity-cn-northern-liang.json`
- Modify: `src/data/source/entities/china/polity-cn-southern-yan.json`
- Modify: `src/data/source/entities/china/polity-cn-western-liang.json`
- Modify: `src/data/source/entities/china/polity-cn-hu-xia.json`
- Modify: `src/data/source/entities/china/polity-cn-northern-yan.json`

**Interfaces:**
- Consumes: Task 1 的批次常量、断言函数和来源命名规则。
- Produces: 十六国 16 个政权的简介、完整正式君主序列、必要的争位记录与来源。

- [ ] **Step 1: 写十六国批次失败测试**

```ts
it("补全两晋与十六国十六个并立政权的详情", () => {
  expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.sixteenKingdoms);
  expect(rulerSnapshot("polity-cn-former-qin", 383).status).toBe("known");
  expect(rulerSnapshot("polity-cn-western-qin", 405).status).toBe("unrecorded");
  expect(rulerSnapshot("polity-cn-western-qin", 410).status).toBe("known");
  expect(rulerSnapshot("polity-cn-northern-liang", 420).status).toBe("known");
});
```

- [ ] **Step 2: 运行测试并确认第二批缺失失败**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL，并定位到第二批第一个尚无任期或简介过短的政权。

- [ ] **Step 3: 检索并登记十六国来源**

优先选择可覆盖多个十六国政权的机构或学术年表，另为存在区间中断、君主身份或纪年冲突的政权补充专门来源。每个来源记录完整 citation、publisher、url 与 `accessedAt: "2026-08-07"`。

- [ ] **Step 4: 录入 16 个政权的数据**

逐文件扩写简介并录入正式君主序列。西秦任期不得跨越 401 至 408 年中断；汉赵、胡夏等重名实体的 ID 必须包含现有政权 token；主要争位者使用 `role: "contender"`，不得以并列 `ruler` 掩盖身份争议。

- [ ] **Step 5: 校验第二批**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS，且首批测试继续通过。

- [ ] **Step 6: 提交第二批数据**

```bash
git add src/data/source/sources/sources.json src/data/source/entities/china tests/data-integrity.test.ts
git commit -m "feat(history): 补全十六国政权详情"
```

### Task 3: 完成南北朝 9 个政权

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/china/polity-cn-northern-wei.json`
- Modify: `src/data/source/entities/china/polity-cn-eastern-wei.json`
- Modify: `src/data/source/entities/china/polity-cn-western-wei.json`
- Modify: `src/data/source/entities/china/polity-cn-northern-qi.json`
- Modify: `src/data/source/entities/china/polity-cn-northern-zhou.json`
- Modify: `src/data/source/entities/china/polity-cn-liu-song.json`
- Modify: `src/data/source/entities/china/polity-cn-southern-qi.json`
- Modify: `src/data/source/entities/china/polity-cn-liang.json`
- Modify: `src/data/source/entities/china/polity-cn-chen.json`

**Interfaces:**
- Consumes: 前两批通过的数据基线与批次完整性断言。
- Produces: 南北朝 9 个政权的详情数据，准确表达分裂、禅代、摄政与权臣控制下的君主任期。

- [ ] **Step 1: 写南北朝批次失败测试**

```ts
it("补全南北朝九个并立政权的详情", () => {
  expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.northernSouthernDynasties);
  expect(rulerSnapshot("polity-cn-northern-wei", 500).status).toBe("known");
  expect(rulerSnapshot("polity-cn-liu-song", 450).status).toBe("known");
  expect(rulerSnapshot("polity-cn-chen", 580).status).toBe("known");
});
```

- [ ] **Step 2: 运行测试并确认第三批缺失失败**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL，并定位到南北朝目标政权。

- [ ] **Step 3: 检索来源并录入 9 个政权**

登记能直接支持南朝四朝与北朝五朝沿革、君主序列和年代的权威来源。扩写简介并录入人物和任期；权臣实际掌权但未摄政者不自动创建 `regent` 任期，只有史料身份符合现有角色语义时才录入。

- [ ] **Step 4: 校验第三批**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS，前三批断言全部通过。

- [ ] **Step 5: 提交第三批数据**

```bash
git add src/data/source/sources/sources.json src/data/source/entities/china tests/data-integrity.test.ts
git commit -m "feat(history): 补全南北朝政权详情"
```

### Task 4: 完成隋唐、五代十国及同期 19 个政权

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/china/polity-cn-wu-zhou.json`
- Modify: `src/data/source/entities/china/polity-cn-later-liang-zhu.json`
- Modify: `src/data/source/entities/china/polity-cn-later-tang.json`
- Modify: `src/data/source/entities/china/polity-cn-later-jin.json`
- Modify: `src/data/source/entities/china/polity-cn-later-han.json`
- Modify: `src/data/source/entities/china/polity-cn-later-zhou.json`
- Modify: `src/data/source/entities/china/polity-cn-yang-wu.json`
- Modify: `src/data/source/entities/china/polity-cn-southern-tang.json`
- Modify: `src/data/source/entities/china/polity-cn-wuyue.json`
- Modify: `src/data/source/entities/china/polity-cn-min.json`
- Modify: `src/data/source/entities/china/polity-cn-ma-chu.json`
- Modify: `src/data/source/entities/china/polity-cn-former-shu.json`
- Modify: `src/data/source/entities/china/polity-cn-later-shu.json`
- Modify: `src/data/source/entities/china/polity-cn-southern-han.json`
- Modify: `src/data/source/entities/china/polity-cn-jingnan.json`
- Modify: `src/data/source/entities/china/polity-cn-northern-han.json`
- Modify: `src/data/source/entities/china/polity-tibet-empire.json`
- Modify: `src/data/source/entities/china/polity-balhae.json`
- Modify: `src/data/source/entities/china/polity-nanzhao.json`

**Interfaces:**
- Consumes: 前三批数据基线与现有多区间任期语义。
- Produces: 武周、五代十国及吐蕃、渤海、南诏的详情数据。

- [ ] **Step 1: 写第四批失败测试**

```ts
it("补全隋唐五代十国及同期区域政权详情", () => {
  expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.suiTangFiveDynasties);
  expect(rulerSnapshot("polity-cn-wu-zhou", 700).status).toBe("known");
  expect(rulerSnapshot("polity-cn-later-tang", 930).status).toBe("known");
  expect(rulerSnapshot("polity-tibet-empire", 755).status).toBe("known");
  expect(rulerSnapshot("polity-nanzhao", 800).status).toBe("known");
});
```

- [ ] **Step 2: 运行测试并确认第四批缺失失败**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL，并定位到第四批目标政权。

- [ ] **Step 3: 检索汉文与区域史来源**

分别核对武周、五代、十国、吐蕃、渤海与南诏的沿革和统治者序列；区域政权保留本地称号时使用 `localTitles`，无法可靠对应汉式帝号时不强行添加。

- [ ] **Step 4: 录入 19 个政权的数据**

逐文件补齐简介、人物和任期。后梁与后凉、后唐与南唐、后晋与后金等重名实体必须使用不同 ID token；短任期仍按闭区间记录，不能为减少记录而合并人物。

- [ ] **Step 5: 校验第四批**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS，前四批断言全部通过。

- [ ] **Step 6: 提交第四批数据**

```bash
git add src/data/source/sources/sources.json src/data/source/entities/china tests/data-integrity.test.ts
git commit -m "feat(history): 补全五代十国及同期政权详情"
```

### Task 5: 完成辽夏金元与明清并立 7 个政权

**Files:**
- Modify: `tests/data-integrity.test.ts`
- Modify: `src/data/source/sources/sources.json`
- Modify: `src/data/source/entities/china/polity-cn-liao.json`
- Modify: `src/data/source/entities/china/polity-dali.json`
- Modify: `src/data/source/entities/china/polity-cn-western-xia.json`
- Modify: `src/data/source/entities/china/polity-cn-jin.json`
- Modify: `src/data/source/entities/china/polity-mongol-empire.json`
- Modify: `src/data/source/entities/china/polity-cn-later-jin-jurchen.json`
- Modify: `src/data/source/entities/china/polity-cn-southern-ming.json`

**Interfaces:**
- Consumes: 前四批数据基线和多语言名称、角色、争议字段。
- Produces: 最后 7 个政权的详情数据，以及全部 55 个目标政权的完整覆盖。

- [ ] **Step 1: 写第五批与总覆盖失败测试**

```ts
it("补全辽夏金元与明清并立政权详情", () => {
  expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.laterPolities);
  expect(rulerSnapshot("polity-cn-liao", 1000).status).toBe("known");
  expect(rulerSnapshot("polity-cn-western-xia", 1100).status).toBe("known");
  expect(rulerSnapshot("polity-cn-jin", 1200).status).toBe("known");
  expect(rulerSnapshot("polity-cn-southern-ming", 1646).entries.length).toBeGreaterThan(0);
});

it("为全部七十一个中国政权提供统治者详情", () => {
  const chinesePolityIds = data.entities
    .filter(({ entityKind, historicalRegionIds }) => {
      return entityKind === "polity" && historicalRegionIds.includes("region-china");
    })
    .map(({ id }) => id);
  expect(chinesePolityIds).toHaveLength(71);
  expect(chinesePolityIds.every((id) => data.reigns.some(({ polityId }) => polityId === id)))
    .toBe(true);
});
```

- [ ] **Step 2: 运行测试并确认第五批缺失失败**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL，并定位到第五批目标政权。

- [ ] **Step 3: 检索并登记多语言政权来源**

为辽、大理、西夏、金、大蒙古国、后金和南明登记直接来源；多语言姓名优先采用来源中的标准转写或本地称号，不自行推导。

- [ ] **Step 4: 录入最后 7 个政权的数据**

逐文件补齐简介、人物和任期。大蒙古国与元、后金与清保持既有实体边界；南明并立君主按实际控制与主流史学口径使用 `ruler` 或 `contender`，并添加争议说明。

- [ ] **Step 5: 校验第五批与总覆盖**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/ruler-snapshot.test.ts tests/data-artifacts.test.ts`

Expected: PASS，71 个中国政权全部至少有一条任期。

- [ ] **Step 6: 提交第五批数据**

```bash
git add src/data/source/sources/sources.json src/data/source/entities/china tests/data-integrity.test.ts
git commit -m "feat(history): 补全辽夏金元与明清并立政权详情"
```

### Task 6: 文档、字体与最终验收

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `docs/data-contract.md`
- Modify if required by font check: `src/assets/fonts/noto-sans-sc-page-400-700.woff2`
- Modify if required by font check: `src/assets/fonts/noto-serif-sc-display-700.woff2`

**Interfaces:**
- Consumes: 完成后的 71 个中国政权详情、实际人物和任期统计、完整验证结果。
- Produces: 准确的覆盖说明、通过字体检查的页面资源和最终质量证据。

- [ ] **Step 1: 计算并记录实际覆盖统计**

Run:

```bash
node --input-type=module -e 'import { loadSourceData } from "./scripts/data-source.ts"; const d=await loadSourceData(); const ids=d.entities.filter(e=>e.entityKind==="polity"&&e.historicalRegionIds.includes("region-china")).map(e=>e.id); console.log({chinesePolities:ids.length,covered:ids.filter(id=>d.reigns.some(r=>r.polityId===id)).length,persons:d.persons.length,reigns:d.reigns.length,sources:d.sources.length});'
```

Expected: `chinesePolities: 71`、`covered: 71`；人物、任期和来源数量使用命令实际输出，不预先虚构。

- [ ] **Step 2: 更新说明文档**

README 将“16 个中国主线政权”改为“全部 71 个已收录中国政权”，并说明非主线政权也包含统治者、角色、年代争议与来源。ROADMAP 在阶段 3 完成记录中补充本次扩展。`docs/data-contract.md` 更新覆盖说明，但保持 schema v3 不变。

- [ ] **Step 3: 运行字体检查**

Run: `npm run check:fonts`

Expected: PASS。若输出列出缺字，运行 `npm run regen:fonts`，再次运行 `npm run check:fonts`，并只保留实际变化的字体子集。

- [ ] **Step 4: 运行完整质量门禁**

Run: `npm run validate:data && npm test && npm run typecheck && npm run check:fonts && npm run build && git diff --check`

Expected: 全部命令 exit 0，无数据校验、测试、类型、字体、构建或空白错误。

- [ ] **Step 5: 检查最终改动边界**

Run: `git status --short && git diff --stat HEAD~5`

逐项核对 55 个目标政权、来源、测试和三份说明文档；确认没有修改 schema、共享类型、页面组件、关系或事件数据，没有生成产物、缓存和调试文件进入 Git。

- [ ] **Step 6: 提交文档和必要字体变更**

```bash
git add README.md ROADMAP.md docs/data-contract.md src/assets/fonts
git commit -m "docs(history): 更新中国政权详情覆盖说明"
```
