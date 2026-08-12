# Offline Historical Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Crownline 增加基于当前年份的离线历史示意地图，使时间轴与地图共享筛选、详情和双政权对比状态。

**Architecture:** 将数据契约升级为 v4，以独立 `GeographicSnapshot` 表达带时间、精度和来源的历史点位；生成器把地理数据输出为按需加载的 `geography.json`，避免扩大首屏索引。React 根组件继续持有共享状态，纯领域模块负责点位选择、等距圆柱投影和确定性聚合，本地 SVG 底图与等价结果列表共同提供地图体验。

**Tech Stack:** React 19、Vite 8、TypeScript 7、JSON Schema 2020-12、Ajv 8、Vitest 4、Testing Library、Natural Earth 1:110m Land。

## Global Constraints

- 不新增地图框架、在线瓦片、后端服务或运行时网络地图请求。
- 地图只展示都城、政治中心或代表性中心点，不绘制或推断疆域、接壤、重叠和主权关系。
- 历史年份继续使用无公元 0 年、闭区间和“年内任一时刻命中”规则。
- 地图视图按当前年份展示真实政权；历史分期不进入地图结果。
- 时间轴与地图共享年份、地区、搜索、类别、详情与两个对比政权。
- 地理根数据损坏只禁用地图；单条坏快照只跳过该记录；时间轴必须继续可用。
- 首批覆盖 20 个世界样本与 15 个中国代表政权，共 59 条地理快照。
- 地图必须提供与图形标记等价的键盘可操作结果列表。
- 不修改依赖、CI、路由或部署方式；继续支持 GitHub Pages 静态部署。
- 每个任务提交前运行该任务的定向测试；阶段完成前运行完整质量门禁。

---

## File Structure

### New files

- `src/data/source/geography/geographic-snapshots.json`：59 条人工校订地理快照。
- `src/data/loadCrownlineGeography.ts`：按需加载并收窄独立地理产物。
- `src/domain/mapSnapshots.ts`：年份选择、投影、缺失统计和确定性聚合。
- `src/components/ViewModeControl.tsx`：时间轴/地图一级视图切换。
- `src/components/MapLoadPanel.tsx`：地图加载失败和重试状态。
- `src/components/HistoricalMap.tsx`：本地底图、点位按钮和聚合展开。
- `src/components/MapResultList.tsx`：与地图等价的详情和对比入口。
- `src/assets/maps/world-land.svg`：Natural Earth 1:110m Land 派生的简化本地底图。
- `src/assets/maps/NOTICE.md`：底图来源、版本、许可和派生命令。
- `tests/map-sample-polities.ts`：35 个首批政权的稳定 ID 清单。
- `tests/map-snapshots.test.ts`：地图领域逻辑测试。
- `tests/map-view.test.tsx`：地图组件与无障碍交互测试。

### Modified files

- `src/domain/types.ts`、`src/data/crownline-data.schema.json`：v4 类型与 Schema。
- `src/domain/dataValidation.ts`：严格地理语义校验。
- `src/data/runtimeValidation.ts`：地理根对象校验与逐条收窄。
- `src/data/artifacts.ts`：派生 `CrownlineGeography` 与来源闭包。
- `scripts/data-source.ts`、`scripts/generate-data.ts`、`scripts/validate-data.ts`：聚合、生成和统计地理数据。
- `src/data/source/core.json`、`src/data/source/sources/sources.json`：v4 与 GeoNames 来源。
- `src/domain/browseState.ts`：独立 `ViewMode` 与 `view=map` URL 状态。
- `src/components/FilterPanel.tsx`：地图下隐藏时间轴模式切换并保持年份控件。
- `src/app/App.tsx`、`src/main.tsx`：地图懒加载、视图组合、详情与对比复用。
- `src/styles/styles.css`：地图、聚合、列表、响应式、深色与减少动态效果样式。
- `tests/data-validation.test.ts`、`tests/data-source.test.ts`、`tests/data-artifacts.test.ts`、`tests/data-loaders.test.ts`、`tests/data-integrity.test.ts`、`tests/browse-state.test.ts`、`tests/app.test.tsx`：契约、产物、状态和应用回归。
- `tests/ruler-snapshot.test.ts`、`tests/polity-comparison.test.ts`、`tests/historical-relationships.test.ts`：测试夹具版本迁移到 v4。
- `docs/data-contract.md`、`README.md`、`ROADMAP.md`：契约、覆盖和阶段完成记录。
- `src/assets/fonts/noto-sans-sc-page-400-700.woff2`、`src/assets/fonts/noto-serif-sc-display-700.woff2`：新增页面字符触发时重新生成。

---

### Task 1: 数据契约升级到 v4

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/data/crownline-data.schema.json`
- Create: `src/data/source/geography/geographic-snapshots.json`
- Modify: `src/data/source/core.json`
- Modify: `scripts/data-source.ts`
- Modify: `src/data/runtimeValidation.ts`
- Modify: `tests/data-validation.test.ts`
- Modify: `tests/data-source.test.ts`
- Modify: `tests/data-loaders.test.ts`
- Modify: `tests/ruler-snapshot.test.ts`
- Modify: `tests/polity-comparison.test.ts`
- Modify: `tests/historical-relationships.test.ts`

**Interfaces:**
- Produces: `GeographicRole`, `PositionPrecision`, `GeographicCoordinates`, `GeographicSnapshot`, `CrownlineGeography`
- Produces: `CrownlineData.schemaVersion`, `CrownlineIndex.schemaVersion`, `CrownlineDetail.schemaVersion` all equal `4`
- Produces: `CrownlineData.geographicSnapshots: GeographicSnapshot[]`

- [ ] **Step 1: Write the failing v4 contract test**

Update `makeValidData()` in `tests/data-validation.test.ts` to use `schemaVersion: 4` and `geographicSnapshots: []`, then add:

```ts
it("接受带来源地理快照的数据契约 v4", () => {
  const data = makeValidData();
  data.geographicSnapshots.push({
    id: "geo-polity-a-capital",
    polityId: "polity-a",
    periods: [period(1, 10)],
    placeName: "甲城",
    role: "capital",
    coordinates: { latitude: 30, longitude: 110 },
    positionPrecision: "approximate",
    positionNote: "现代坐标仅用于示意历史地点。",
    sourceRefs: [{ sourceId: "source-a" }],
    confidence: "high"
  });

expect(validateCrownlineData(data)).toEqual({ valid: true, issues: [] });
});
```

Add two schema rejection assertions by changing the same snapshot to latitude `91` and longitude `181`; each result must contain `SCHEMA_ERROR`.

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `npx vitest run tests/data-validation.test.ts`

Expected: FAIL because the v3 types and Schema reject `schemaVersion: 4` and `geographicSnapshots`.

- [ ] **Step 3: Add the exact v4 types and JSON Schema**

Add to `src/domain/types.ts`:

```ts
export const GEOGRAPHIC_ROLES = ["capital", "political-center", "representative-center"] as const;
export const POSITION_PRECISIONS = ["exact", "approximate", "regional"] as const;

export type GeographicRole = (typeof GEOGRAPHIC_ROLES)[number];
export type PositionPrecision = (typeof POSITION_PRECISIONS)[number];

export interface GeographicCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeographicSnapshot {
  id: string;
  polityId: string;
  periods: HistoricalInterval[];
  placeName: string;
  role: GeographicRole;
  coordinates: GeographicCoordinates;
  positionPrecision: PositionPrecision;
  positionNote: string;
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}

export interface CrownlineGeography {
  schemaVersion: 4;
  geographicSnapshots: GeographicSnapshot[];
  sources: Source[];
}
```

Change the three existing runtime artifact interfaces to `schemaVersion: 4` and add `geographicSnapshots` to `CrownlineData`. In the JSON Schema, change `$id`, title and version constant to v4; require `geographicSnapshots`; add a `geographicSnapshot` definition with closed coordinate ranges, non-empty periods/source refs and the exact enums above.

Create the production geography source file as `[]`. Extend `loadSourceData()` with the existing directory reader so all intermediate commits typecheck:

```ts
geographicSnapshots: await readArrayFiles(
  join(sourceRoot, "geography"),
  "地理快照"
)
```

Make the temporary source fixture in `tests/data-source.test.ts` write the same geography path and assert the empty array round-trips.

Update production `core.json`, all active test fixtures and runtime version messages from 3 to 4. Do not rewrite historical design documents that intentionally describe v3.

- [ ] **Step 4: Run the migrated contract and loader tests**

Run: `npx vitest run tests/data-validation.test.ts tests/data-source.test.ts tests/data-loaders.test.ts tests/ruler-snapshot.test.ts tests/polity-comparison.test.ts tests/historical-relationships.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/data/crownline-data.schema.json src/data/source/core.json src/data/source/geography/geographic-snapshots.json scripts/data-source.ts src/data/runtimeValidation.ts tests/data-validation.test.ts tests/data-source.test.ts tests/data-loaders.test.ts tests/ruler-snapshot.test.ts tests/polity-comparison.test.ts tests/historical-relationships.test.ts
git commit -m "feat(data): 定义地理快照契约"
```

---

### Task 2: 地理快照严格语义校验

**Files:**
- Modify: `src/domain/dataValidation.ts`
- Modify: `tests/data-validation.test.ts`

**Interfaces:**
- Consumes: `CrownlineData.geographicSnapshots`
- Produces: strict build-time issue codes `DANGLING_ENTITY_REF`, `DANGLING_SOURCE_REF`, `INVALID_INTERVAL`, `OVERLAPPING_INTERVALS`, `ADJACENT_INTERVALS`, `GEOGRAPHY_OUTSIDE_POLITY`, `DUPLICATE_GEOGRAPHIC_SNAPSHOT`, `EMPTY_POSITION_NOTE`, `MISSING_CONFIDENCE_NOTE`

- [ ] **Step 1: Write failing table-driven validation tests**

Add cases that mutate one valid snapshot at a time:

```ts
it.each([
  ["悬空政权", (s: GeographicSnapshot) => { s.polityId = "polity-missing"; }, "DANGLING_ENTITY_REF"],
  ["悬空来源", (s: GeographicSnapshot) => { s.sourceRefs = [{ sourceId: "source-missing" }]; }, "DANGLING_SOURCE_REF"],
  ["公元零年", (s: GeographicSnapshot) => { s.periods = [period(0, 1)]; }, "INVALID_INTERVAL"],
  ["越过政权存在期", (s: GeographicSnapshot) => { s.periods = [period(1, 11)]; }, "GEOGRAPHY_OUTSIDE_POLITY"],
  ["空位置说明", (s: GeographicSnapshot) => { s.positionNote = "   "; }, "EMPTY_POSITION_NOTE"],
  ["争议说明缺失", (s: GeographicSnapshot) => { s.confidence = "disputed"; }, "MISSING_CONFIDENCE_NOTE"]
])("拒绝%s", (_label, mutate, code) => {
  const data = makeValidDataWithGeography();
  mutate(data.geographicSnapshots[0]!);
  expect(issueCodes(data)).toContain(code);
});
```

Add independent tests for adjacent/overlapping periods and duplicate polity/place/role/period tuples.

- [ ] **Step 2: Run the semantic tests and verify they fail**

Run: `npx vitest run tests/data-validation.test.ts`

Expected: FAIL because geography-specific semantic checks do not exist.

- [ ] **Step 3: Implement geography validation in the existing linear validation flow**

Add snapshot IDs to the global ID uniqueness input. For each snapshot:

```ts
const polity = entityById.get(snapshot.polityId);
if (!polity || polity.entityKind !== "polity") addIssue("DANGLING_ENTITY_REF", ...);
validateIntervals(snapshot.periods, `${path}/periods`, issues);
validateSourceRefs(snapshot.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
if (polity && !snapshot.periods.every((period) => intervalIsCovered(period, polity.existencePeriods))) {
  addIssue("GEOGRAPHY_OUTSIDE_POLITY", `${path}/periods`, ...);
}
```

Implement `intervalIsCovered` using historical ordinals so crossing BCE/CE never invents year zero. Reuse existing interval sorting and overlap rules; do not extract forwarding helpers that have no independent meaning.

- [ ] **Step 4: Run strict validation tests**

Run: `npx vitest run tests/data-validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/dataValidation.ts tests/data-validation.test.ts
git commit -m "feat(data): 校验地理快照语义"
```

---

### Task 3: 生成独立 geography.json

**Files:**
- Modify: `src/data/artifacts.ts`
- Modify: `scripts/generate-data.ts`
- Modify: `scripts/validate-data.ts`
- Modify: `tests/data-source.test.ts`
- Modify: `tests/data-artifacts.test.ts`

**Interfaces:**
- Produces: `GeneratedArtifacts.geography: CrownlineGeography`
- Produces: `public/data/generated/geography.json`

- [ ] **Step 1: Write failing source and artifact tests**

The source round-trip is already covered by Task 1. Add artifact assertions:

```ts
expect(artifacts.index).not.toHaveProperty("geographicSnapshots");
expect(artifacts.geography).toEqual({
  schemaVersion: 4,
  geographicSnapshots: fixture.geographicSnapshots,
  sources: expect.any(Array)
});
```

Add a snapshot referring to `source-a` and an unrelated `source-b`; assert `artifacts.geography.sources` contains only `source-a`.

- [ ] **Step 2: Run source and artifact tests and verify they fail**

Run: `npx vitest run tests/data-source.test.ts tests/data-artifacts.test.ts`

Expected: FAIL because geography is not aggregated or generated.

- [ ] **Step 3: Implement source aggregation and artifact generation**

Extend `buildGeneratedArtifacts()` to collect all snapshot source IDs and return:

```ts
const geography: CrownlineGeography = {
  schemaVersion: data.schemaVersion,
  geographicSnapshots: data.geographicSnapshots,
  sources: data.sources.filter(({ id }) => geographySourceIds.has(id))
};
```

Write `geography.json` beside `index.json`; add `geographicSnapshots` to `GeneratedDataSummary` and both generation/validation console summaries.

- [ ] **Step 4: Verify source round-trip and generated file**

Run: `npx vitest run tests/data-source.test.ts tests/data-artifacts.test.ts && npm run generate:data`

Expected: PASS and the summary reports `0 条地理快照`; `public/data/generated/geography.json` exists.

- [ ] **Step 5: Commit**

```bash
git add src/data/artifacts.ts scripts/generate-data.ts scripts/validate-data.ts tests/data-artifacts.test.ts
git commit -m "feat(data): 生成独立地理数据"
```

---

### Task 4: 录入 20 个世界样本点位

**Files:**
- Modify: `src/data/source/geography/geographic-snapshots.json`
- Modify: `src/data/source/sources/sources.json`
- Create: `tests/map-sample-polities.ts`
- Modify: `tests/data-integrity.test.ts`

**Interfaces:**
- Produces: `WORLD_MAP_POLITY_IDS: readonly string[]`
- Produces: 37 world `GeographicSnapshot` records
- Adds source: `source-geonames`

- [ ] **Step 1: Add the failing world coverage test**

Create this exact shared list and assert every ID has at least one snapshot, all records have source refs, and the world set has exactly 37 snapshots:

```ts
export const WORLD_MAP_POLITY_IDS = [
  "polity-byzantine-empire",
  "polity-abbasid-caliphate",
  "polity-holy-roman-empire",
  "polity-chola-empire",
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

```ts
const worldSnapshots = data.geographicSnapshots.filter(({ polityId }) => {
  return WORLD_MAP_POLITY_IDS.includes(polityId);
});
expect(worldSnapshots).toHaveLength(37);
for (const polityId of WORLD_MAP_POLITY_IDS) {
  expect(worldSnapshots.some((snapshot) => snapshot.polityId === polityId), polityId).toBe(true);
}
```

- [ ] **Step 2: Run the world coverage test and verify it fails**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL with zero world geography snapshots.

- [ ] **Step 3: Add the coordinate dataset source**

Append this exact source record:

```json
{
  "id": "source-geonames",
  "title": "GeoNames Geographical Database",
  "sourceType": "dataset",
  "citation": "GeoNames geographical database；用于将历史地点对应到现代 WGS 84 示意坐标，数据采用 CC BY 4.0。",
  "publisher": "GeoNames",
  "url": "https://www.geonames.org/",
  "accessedAt": "2026-08-12"
}
```

- [ ] **Step 4: Write the 37 world snapshots from this exact ledger**

Every record uses `positionPrecision: "approximate"` and `confidence: "high"`, except Begram and Niani which use `positionPrecision: "regional"`, `confidence: "medium"`. Each record references `source-geonames` plus the historical source in the last column.

| Snapshot ID | Polity | Place / role | Periods | Lat, Lon | Historical source |
|---|---|---|---|---|---|
| `geo-byzantine-constantinople` | Byzantine | Constantinople / capital | 330–1203; 1261–1453 | 41.0082, 28.9784 | `source-met-byzantium` |
| `geo-byzantine-nicaea` | Byzantine | Nicaea / political-center | 1204–1260 | 40.4297, 29.7214 | `source-met-byzantium` |
| `geo-abbasid-baghdad` | Abbasid | Baghdad / capital | 762–1258 | 33.3152, 44.3661 | `source-met-abbasid` |
| `geo-hre-aachen` | HRE | Aachen / representative-center | 962–1024 | 50.7753, 6.0839 | `source-dhm-hre` |
| `geo-chola-thanjavur` | Chola | Thanjavur / capital | 850–1024 | 10.7870, 79.1378 | `source-inflibnet-chola` |
| `geo-chola-gangaikonda` | Chola | Gangaikonda Cholapuram / capital | 1025–1279 | 11.2065, 79.4494 | `source-inflibnet-chola` |
| `geo-goryeo-gaegyeong` | Goryeo | Gaegyeong / capital | 918–1231; 1270–1392 | 37.9708, 126.5544 | `source-goryeo-history` |
| `geo-goryeo-ganghwa` | Goryeo | Ganghwa / political-center | 1232–1269 | 37.7465, 126.4880 | `source-goryeo-history` |
| `geo-tokugawa-edo` | Tokugawa | Edo / political-center | 1603–1868 | 35.6762, 139.6503 | `source-tokugawa-history` |
| `geo-khmer-angkor` | Khmer | Angkor / political-center | 802–1431 | 13.4125, 103.8670 | `source-khmer-history` |
| `geo-majapahit-trowulan` | Majapahit | Trowulan / political-center | 1293–1527 | -7.5599, 112.3800 | `source-majapahit-history` |
| `geo-kushan-begram` | Kushan | Begram / representative-center | 50–230 | 34.9667, 69.3000 | `source-kushan-history` |
| `geo-timurid-samarkand` | Timurid | Samarkand / capital | 1370–1404 | 39.6542, 66.9597 | `source-timurid-history` |
| `geo-timurid-herat` | Timurid | Herat / political-center | 1405–1507 | 34.3529, 62.2040 | `source-timurid-history` |
| `geo-maurya-pataliputra` | Maurya | Pataliputra / capital | -322–-185 | 25.5941, 85.1376 | `source-maurya-history` |
| `geo-mughal-agra` | Mughal | Agra / capital | 1526–1570; 1598–1647 | 27.1767, 78.0081 | `source-mughal-history` |
| `geo-mughal-fatehpur-sikri` | Mughal | Fatehpur Sikri / capital | 1571–1584 | 27.0945, 77.6679 | `source-mughal-history` |
| `geo-mughal-lahore` | Mughal | Lahore / political-center | 1585–1597 | 31.5204, 74.3587 | `source-mughal-history` |
| `geo-mughal-delhi` | Mughal | Delhi / capital | 1648–1857 | 28.6139, 77.2090 | `source-mughal-history` |
| `geo-seljuk-nishapur` | Seljuk | Nishapur / political-center | 1037–1050 | 36.2141, 58.7961 | `source-seljuk-history` |
| `geo-seljuk-ray` | Seljuk | Ray / political-center | 1051–1073 | 35.5960, 51.4393 | `source-seljuk-history` |
| `geo-seljuk-isfahan` | Seljuk | Isfahan / capital | 1074–1117 | 32.6546, 51.6680 | `source-seljuk-history` |
| `geo-seljuk-merv` | Seljuk | Merv / political-center | 1118–1157 | 37.6621, 62.1911 | `source-seljuk-history` |
| `geo-seljuk-hamadan` | Seljuk | Hamadan / political-center | 1158–1194 | 34.7980, 48.5150 | `source-seljuk-history` |
| `geo-ottoman-sogut` | Ottoman | Söğüt / political-center | 1299–1325 | 40.0153, 30.1817 | `source-ottoman-history` |
| `geo-ottoman-bursa` | Ottoman | Bursa / capital | 1326–1364 | 40.1950, 29.0600 | `source-ottoman-history` |
| `geo-ottoman-edirne` | Ottoman | Edirne / capital | 1365–1452 | 41.6771, 26.5557 | `source-ottoman-history` |
| `geo-ottoman-istanbul` | Ottoman | Istanbul / capital | 1453–1922 | 41.0082, 28.9784 | `source-ottoman-history` |
| `geo-frankish-aachen` | Frankish | Aachen / representative-center | 794–843 | 50.7753, 6.0839 | `source-frankish-history` |
| `geo-england-winchester` | England | Winchester / political-center | 927–1065 | 51.0632, -1.3080 | `source-england-history` |
| `geo-england-london` | England | London / capital | 1066–1649; 1660–1707 | 51.5074, -0.1278 | `source-england-history` |
| `geo-fatimid-mahdia` | Fatimid | Mahdia / capital | 909–947 | 35.5047, 11.0622 | `source-fatimid-history` |
| `geo-fatimid-mansuriya` | Fatimid | Mansuriya / capital | 948–972 | 35.6714, 10.0990 | `source-fatimid-history` |
| `geo-fatimid-cairo` | Fatimid | Cairo / capital | 973–1171 | 30.0444, 31.2357 | `source-fatimid-history` |
| `geo-mali-niani` | Mali | Niani / representative-center | 1235–1610 | 11.3667, -8.4167 | `source-mali-history` |
| `geo-aztec-tenochtitlan` | Aztec | Tenochtitlan / capital | 1428–1521 | 19.4326, -99.1332 | `source-aztec-history` |
| `geo-inca-cusco` | Inca | Cusco / capital | 1438–1533 | -13.5319, -71.9675 | `source-inca-history` |

Use these exact notes by role:

```text
capital: 坐标采用 GeoNames 对应现代地点坐标，仅用于标示历史都城的大致位置，不表示政权疆域。
political-center: 坐标采用 GeoNames 对应现代地点坐标，仅表示该时期政治中心的大致位置，不表示固定首都或政权疆域。
representative-center: 坐标采用 GeoNames 对应现代地点坐标，仅作为该政权的浏览定位点，不表示固定首都、疆域中心或控制范围。
```

- [ ] **Step 5: Validate and commit the world batch**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts`

Expected: PASS; summary reports 37 geographic snapshots.

```bash
git add src/data/source/geography/geographic-snapshots.json src/data/source/sources/sources.json tests/map-sample-polities.ts tests/data-integrity.test.ts
git commit -m "feat(data): 录入世界样本地理点位"
```

---

### Task 5: 录入 15 个中国代表政权点位

**Files:**
- Modify: `src/data/source/geography/geographic-snapshots.json`
- Modify: `tests/map-sample-polities.ts`
- Modify: `tests/data-integrity.test.ts`

**Interfaces:**
- Produces: `CHINA_MAP_POLITY_IDS: readonly string[]`
- Produces: 22 China snapshots and 59 total snapshots

- [ ] **Step 1: Add the failing China coverage and migration tests**

Define the exact 15 IDs from the design:

```ts
export const CHINA_MAP_POLITY_IDS = [
  "polity-cn-shang",
  "polity-cn-western-zhou",
  "polity-cn-qin",
  "polity-cn-western-han",
  "polity-cn-eastern-han",
  "polity-cn-cao-wei",
  "polity-cn-shu-han",
  "polity-cn-eastern-wu",
  "polity-cn-northern-wei",
  "polity-cn-tang",
  "polity-cn-northern-song",
  "polity-cn-southern-song",
  "polity-cn-yuan",
  "polity-cn-ming",
  "polity-cn-qing"
] as const;
```

Assert all have snapshots, total production geography is 59, and the snapshot polities collectively cover these nine top-level historical regions:

```ts
expect(mappedTopLevelRegionIds()).toEqual(new Set([
  "region-east-asia",
  "region-south-asia",
  "region-southeast-asia",
  "region-central-asia",
  "region-west-asia",
  "region-europe",
  "region-north-africa",
  "region-west-africa",
  "region-americas"
]));
```

Also assert these transitions resolve exactly:

```ts
expect(activePlaces("polity-cn-northern-wei", 450)).toEqual(["平城"]);
expect(activePlaces("polity-cn-northern-wei", 500)).toEqual(["洛阳"]);
expect(activePlaces("polity-cn-ming", 1400)).toEqual(["南京"]);
expect(activePlaces("polity-cn-ming", 1500)).toEqual(["北京"]);
expect(activePlaces("polity-cn-qing", 1640)).toEqual(["盛京"]);
expect(activePlaces("polity-cn-qing", 1700)).toEqual(["北京"]);
```

- [ ] **Step 2: Run the China coverage test and verify it fails**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL because the 22 China snapshots are absent.

- [ ] **Step 3: Append the exact China snapshot ledger**

Every record uses the same exact role notes from Task 4 and also references `source-geonames`.

| Snapshot ID | Polity | Place / role | Periods | Lat, Lon | Historical source |
|---|---|---|---|---|---|
| `geo-shang-yin` | Shang | 殷 / capital | -1250–-1046 | 36.0996, 114.3924 | `source-cn-chronology-table` |
| `geo-western-zhou-haojing` | Western Zhou | 镐京 / capital | -1046–-771 | 34.2200, 108.7200 | `source-cn-chronology-table` |
| `geo-qin-xianyang` | Qin | 咸阳 / capital | -221–-206 | 34.3296, 108.7080 | `source-cn-chronology-table` |
| `geo-western-han-changan` | Western Han | 长安 / capital | -202–8 | 34.2658, 108.9541 | `source-cn-chronology-table` |
| `geo-eastern-han-luoyang` | Eastern Han | 洛阳 / capital | 25–189 | 34.6197, 112.4540 | `source-cn-chronology-table` |
| `geo-eastern-han-changan` | Eastern Han | 长安 / political-center | 190–195 | 34.2658, 108.9541 | `source-cn-chronology-table` |
| `geo-eastern-han-xuchang` | Eastern Han | 许昌 / political-center | 196–220 | 34.0357, 113.8523 | `source-cn-chronology-table` |
| `geo-cao-wei-luoyang` | Cao Wei | 洛阳 / capital | 220–265 | 34.6197, 112.4540 | `source-zgbk-three-kingdoms` |
| `geo-shu-han-chengdu` | Shu Han | 成都 / capital | 221–263 | 30.5728, 104.0668 | `source-zgbk-three-kingdoms` |
| `geo-eastern-wu-wuchang` | Eastern Wu | 武昌 / political-center | 222–228 | 30.5538, 114.3162 | `source-zgbk-three-kingdoms` |
| `geo-eastern-wu-jianye` | Eastern Wu | 建业 / capital | 229–280 | 32.0603, 118.7969 | `source-zgbk-three-kingdoms` |
| `geo-northern-wei-shengle` | Northern Wei | 盛乐 / political-center | 386–397 | 40.5400, 111.8200 | `source-shanxi-yungang-chronology` |
| `geo-northern-wei-pingcheng` | Northern Wei | 平城 / capital | 398–493 | 40.0768, 113.3001 | `source-shanxi-yungang-chronology` |
| `geo-northern-wei-luoyang` | Northern Wei | 洛阳 / capital | 494–534 | 34.6197, 112.4540 | `source-shanxi-yungang-chronology` |
| `geo-tang-changan` | Tang | 长安 / capital | 618–690; 705–907 | 34.2658, 108.9541 | `source-cn-chronology-table` |
| `geo-northern-song-kaifeng` | Northern Song | 开封 / capital | 960–1127 | 34.7973, 114.3076 | `source-cn-chronology-table` |
| `geo-southern-song-linan` | Southern Song | 临安 / capital | 1129–1279 | 30.2741, 120.1551 | `source-cn-chronology-table` |
| `geo-yuan-dadu` | Yuan | 大都 / capital | 1271–1368 | 39.9042, 116.4074 | `source-cn-chronology-table` |
| `geo-ming-nanjing` | Ming | 南京 / capital | 1368–1420 | 32.0603, 118.7969 | `source-cn-chronology-table` |
| `geo-ming-beijing` | Ming | 北京 / capital | 1421–1644 | 39.9042, 116.4074 | `source-cn-chronology-table` |
| `geo-qing-shengjing` | Qing | 盛京 / capital | 1636–1643 | 41.8057, 123.4315 | `source-dpm-later-jin` |
| `geo-qing-beijing` | Qing | 北京 / capital | 1644–1912 | 39.9042, 116.4074 | `source-dpm-later-jin` |

Use `positionPrecision: "regional"`, `confidence: "medium"` for 殷、镐京、盛乐; use `positionPrecision: "approximate"`, `confidence: "high"` for the other 19 records.

- [ ] **Step 4: Verify all first-batch data**

Run: `npm run validate:data && npx vitest run tests/data-integrity.test.ts tests/data-artifacts.test.ts`

Expected: PASS; 35 polity IDs and 59 snapshots; v4 artifact source closure remains valid.

- [ ] **Step 5: Commit**

```bash
git add src/data/source/geography/geographic-snapshots.json tests/map-sample-polities.ts tests/data-integrity.test.ts
git commit -m "feat(data): 录入中国代表地理点位"
```

---

### Task 6: 地理运行时逐条收窄与加载器

**Files:**
- Create: `src/data/loadCrownlineGeography.ts`
- Modify: `src/data/runtimeValidation.ts`
- Modify: `tests/data-loaders.test.ts`

**Interfaces:**
- Produces: `GeographyLoadResult = { geography: CrownlineGeography; omittedCount: number }`
- Produces: `CrownlineGeographyLoader = () => Promise<GeographyLoadResult>`
- Produces: `asCrownlineGeography(input: unknown): GeographyLoadResult`
- Produces: `loadGeneratedGeography(fetchData?: FetchData): Promise<GeographyLoadResult>`

- [ ] **Step 1: Write failing root-error and item-isolation tests**

```ts
expect(() => asCrownlineGeography({ schemaVersion: 4 })).toThrow("地理数据校验失败");

const result = asCrownlineGeography({
  ...geography,
  geographicSnapshots: [validSnapshot, { broken: true }]
});
expect(result.geography.geographicSnapshots).toEqual([validSnapshot]);
expect(result.omittedCount).toBe(1);
```

Mock `fetchData` and assert the loader requests `new URL("./data/generated/geography.json", document.baseURI)` and rejects non-OK responses with `无法加载地理数据（HTTP 503）`.

- [ ] **Step 2: Run loader tests and verify they fail**

Run: `npx vitest run tests/data-loaders.test.ts`

Expected: FAIL because the parser and loader do not exist.

- [ ] **Step 3: Implement strict root validation and isolated item narrowing**

Require version 4, object-array roots, valid source IDs and required snapshot scalar fields. Validate each snapshot independently; if its structure, coordinate, periods, polity ID string or source references are invalid, increment `omittedCount` and omit it. Do not mutate the input object.

Implement the loader using the same fetch injection pattern as `loadCrownlineDetail.ts`; export the loader type for `AppProps`.

- [ ] **Step 4: Run loader tests**

Run: `npx vitest run tests/data-loaders.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/loadCrownlineGeography.ts src/data/runtimeValidation.ts tests/data-loaders.test.ts
git commit -m "feat(map): 按需加载地理数据"
```

---

### Task 7: 地图点位选择、投影与确定性聚合

**Files:**
- Create: `src/domain/mapSnapshots.ts`
- Create: `tests/map-snapshots.test.ts`

**Interfaces:**
- Produces: `projectCoordinates(coordinates): { xPercent: number; yPercent: number }`
- Produces: `selectMapSnapshots(polities, snapshots, year): MapSelection`
- Produces: `clusterMapPoints(points, thresholdPercent?): MapCluster[]`
- Produces: `MapSelection = { points; clusters; missingEntities }`
- Produces: `GEOGRAPHIC_ROLE_NAMES: Record<GeographicRole, string>` with `都城`, `政治中心`, `代表性中心`

- [ ] **Step 1: Write failing domain tests**

Cover exact projection boundaries:

```ts
expect(projectCoordinates({ latitude: 90, longitude: -180 })).toEqual({ xPercent: 0, yPercent: 0 });
expect(projectCoordinates({ latitude: 0, longitude: 0 })).toEqual({ xPercent: 50, yPercent: 50 });
expect(projectCoordinates({ latitude: -90, longitude: 180 })).toEqual({ xPercent: 100, yPercent: 100 });
```

Add tests for closed interval endpoints, Tang's interrupted period, two simultaneous centers, missing geography, and stable grouping of nearby Beijing/Nanjing test points regardless of input order.

- [ ] **Step 2: Run domain tests and verify they fail**

Run: `npx vitest run tests/map-snapshots.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure domain module**

Use:

```ts
export const MAP_CLUSTER_DISTANCE_PERCENT = 4;

export function projectCoordinates({ latitude, longitude }: GeographicCoordinates) {
  return {
    xPercent: ((longitude + 180) / 360) * 100,
    yPercent: ((90 - latitude) / 180) * 100
  };
}
```

Sort points by `xPercent`, then `yPercent`, `entity.id`, `snapshot.id`. Build clusters in that order by Euclidean percentage distance to the first point in each cluster; use stable cluster IDs composed from sorted snapshot IDs. A single point is still returned as a one-point cluster so the UI consumes one shape.

- [ ] **Step 4: Run the domain suite**

Run: `npx vitest run tests/map-snapshots.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/mapSnapshots.ts tests/map-snapshots.test.ts
git commit -m "feat(map): 选择并聚合历史点位"
```

---

### Task 8: 独立视图状态与筛选面板

**Files:**
- Create: `src/components/ViewModeControl.tsx`
- Modify: `src/domain/browseState.ts`
- Modify: `src/components/FilterPanel.tsx`
- Modify: `tests/browse-state.test.ts`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- Produces: `ViewMode = "timeline" | "map"`
- Adds: `BrowseState.viewMode`
- Adds: `FilterPanelProps.showModeSwitch`, `FilterPanelProps.showYearControls`
- Produces: `ViewModeControl({ value, onChange })`

- [ ] **Step 1: Write failing URL and control tests**

```ts
expect(readBrowseState("?view=map&year=1400", bounds)).toMatchObject({
  viewMode: "map",
  mode: "overview",
  year: 1400
});
expect(readBrowseState("?view=unknown", bounds).viewMode).toBe("timeline");
expect(writeBrowseState({ ...defaultState, viewMode: "map" }, bounds).get("view")).toBe("map");
```

In the app test, click “地图” and assert the current year controls remain visible while “全览/时间点” controls disappear; click “时间轴” and assert the previous browse mode returns.

- [ ] **Step 2: Run state tests and verify they fail**

Run: `npx vitest run tests/browse-state.test.ts tests/app.test.tsx`

Expected: FAIL because `viewMode` and the view control do not exist.

- [ ] **Step 3: Implement view state without reusing BrowseMode**

Read only `view=map` as map; delete/write `view` alongside existing known params. Add `viewMode: "timeline"` to every test state literal.

Render `ViewModeControl` with a native button group and `aria-pressed`. Let `FilterPanel` render its existing browse mode buttons only when `showModeSwitch`, its year panel when `showYearControls`, and its category legend only when the timeline overview is actually visible.

- [ ] **Step 4: Run browse state and filter regressions**

Run: `npx vitest run tests/browse-state.test.ts tests/app.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ViewModeControl.tsx src/domain/browseState.ts src/components/FilterPanel.tsx tests/browse-state.test.ts tests/app.test.tsx
git commit -m "feat(map): 同步地图视图状态"
```

---

### Task 9: 生成并记录离线世界底图

**Files:**
- Create: `src/assets/maps/world-land.svg`
- Create: `src/assets/maps/NOTICE.md`

**Interfaces:**
- Produces: static SVG with `viewBox="0 0 1000 500"`, no scripts, external links, labels or modern boundaries

- [ ] **Step 1: Acquire the pinned source outside the production build**

Use Natural Earth Vector tag `v5.1.2`, file `geojson/ne_110m_land.geojson`:

```bash
curl -L 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson' \
  -o /tmp/crownline-ne-110m-land.geojson
```

Do not add the GeoJSON or mapshaper to application dependencies.

- [ ] **Step 2: Generate the simplified SVG**

Run the one-time conversion in a temporary directory:

```bash
npx --yes mapshaper@0.6.113 /tmp/crownline-ne-110m-land.geojson \
  -proj wgs84 -simplify 12% keep-shapes \
  -style fill='#000000' stroke='none' \
  -o format=svg width=1000 margin=0 /tmp/crownline-world-land.svg
```

Use `apply_patch` to normalize the generated root to `viewBox="0 0 1000 500"`, remove fixed width/height, metadata, labels and any script/external reference, then copy the reviewed asset to the target path.

- [ ] **Step 3: Record provenance and verify the asset**

`NOTICE.md` must name Natural Earth 1:110m Land, tag v5.1.2, the source URL, Natural Earth's public-domain terms URL `https://www.naturalearthdata.com/about/terms-of-use/`, access date 2026-08-12, and the exact conversion command above.

Run:

```bash
rg -n 'viewBox="0 0 1000 500"' src/assets/maps/world-land.svg
rg -n '<script|href=' src/assets/maps/world-land.svg
```

Expected: the first command matches once; the second returns no matches.

- [ ] **Step 4: Commit**

```bash
git add src/assets/maps/world-land.svg src/assets/maps/NOTICE.md
git commit -m "feat(map): 加入离线世界底图"
```

---

### Task 10: 地图、聚合与等价结果列表组件

**Files:**
- Create: `src/components/MapLoadPanel.tsx`
- Create: `src/components/HistoricalMap.tsx`
- Create: `src/components/MapResultList.tsx`
- Create: `tests/map-view.test.tsx`

**Interfaces:**
- `HistoricalMap({ clusters, onSelect })`, where `onSelect(entityId, trigger: HTMLButtonElement)` opens detail and cluster expansion state remains internal
- `MapResultList({ points, missingEntities, comparisonEntityIds, onSelect, onToggleComparison })`, with the same detail trigger signature
- `MapLoadPanel({ state, onRetry })`, where state is `loading | { error: string }`

- [ ] **Step 1: Write failing component tests**

Test these exact accessible behaviors:

```ts
expect(screen.getByRole("region", { name: "当前年份历史政权示意地图" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "北魏，洛阳，都城" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "此处有 2 个历史点位" })).toHaveAttribute("aria-expanded", "false");
expect(screen.getByRole("region", { name: "地图结果列表" })).toHaveTextContent("尚未校订地理数据");
```

Click a marker and list item and assert the exact entity ID reaches `onSelect`; click comparison controls and assert the existing button labels and disabled third-selection behavior.

- [ ] **Step 2: Run component tests and verify they fail**

Run: `npx vitest run tests/map-view.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement semantic presentational components**

Import the SVG as a Vite asset URL and render it as a decorative `<img alt="">` inside a container whose enclosing region has the accessible map label. Render single-point clusters as positioned native buttons. Render multi-point clusters as buttons with `aria-expanded`; their expanded panel is a named list of point buttons.

Use the same `points` array for `MapResultList`; do not re-filter data in a component. Use `ComparisonToggle` rather than recreating comparison rules. `MapLoadPanel` exposes loading status, an alert on failure, and a native retry button.

- [ ] **Step 4: Run component tests**

Run: `npx vitest run tests/map-view.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapLoadPanel.tsx src/components/HistoricalMap.tsx src/components/MapResultList.tsx tests/map-view.test.tsx
git commit -m "feat(map): 构建地图与结果列表"
```

---

### Task 11: 应用整合、懒加载与交互回归

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles/styles.css`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- Adds App prop: `loadGeography: CrownlineGeographyLoader`
- Adds state: `idle | loading | ready | error`, request sequence and cached successful result
- Consumes: `selectMapSnapshots()` and map components

- [ ] **Step 1: Extend the App test harness and write failing integration tests**

Change `renderApp` to inject both loaders. Add tests for:

1. `/?view=map&year=500` loads geography once and shows 北魏/洛阳.
2. Switching map → timeline → map reuses the successful result without another request.
3. An HTTP/load rejection shows “无法加载地理数据” and retry succeeds.
4. A rejected old request after leaving/re-entering map does not overwrite the newer success.
5. `type=context` shows the explicit “历史分期不进入地图” empty explanation.
6. A marker opens the existing detail dialog; list controls add two polities to comparison.
7. `omittedCount: 1` displays the skipped-record warning without hiding valid markers.

- [ ] **Step 2: Run integration tests and verify they fail**

Run: `npx vitest run tests/app.test.tsx`

Expected: FAIL because App does not accept or render geography.

- [ ] **Step 3: Implement the map load state and view composition**

Pass `loadGeneratedGeography` from `main.tsx`. Start loading only when `viewMode === "map"` and state is idle/error retry. Cache ready data, increment a request sequence before every request, and ignore stale completion.

In map view, derive timepoint polity results with the existing selector regardless of `BrowseState.mode`, then pass them and valid snapshots to `selectMapSnapshots()`. Keep `ComparisonPanel` above both content views and reuse `openDetail`, `toggleComparison` and `lastTriggerRef`.

Render result summaries with exact distinctions:

```text
没有当年匹配的政权。
当年有匹配政权，但这些政权尚未校订地理数据。
有 N 条地理记录格式异常，已跳过。
历史分期不进入地图；请选择真实政权类别。
```

- [ ] **Step 4: Add intentional map styling and accessibility states**

Add scoped styles for `.view-mode-control`, `.historical-map-shell`, `.world-map`, `.map-marker`, `.map-cluster`, `.map-cluster-panel`, `.map-result-list`, `.map-missing-list` and load/error states. Requirements:

- use existing color variables and serif display typography;
- marker role is distinguishable by shape/icon and label, not color alone;
- visible `:focus-visible` rings;
- no horizontal overflow at 375px;
- stacked result cards below 760px;
- dark-mode variables remain inherited;
- transitions disabled under the existing `prefers-reduced-motion` block.

- [ ] **Step 5: Run app, map and existing UI regressions**

Run: `npx vitest run tests/app.test.tsx tests/map-view.test.tsx tests/browse-state.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/main.tsx src/styles/styles.css tests/app.test.tsx
git commit -m "feat(map): 接通地图浏览体验"
```

---

### Task 12: 文档、字体、完整验证与路线图收尾

**Files:**
- Modify: `docs/data-contract.md`
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify if generated: `src/assets/fonts/noto-sans-sc-page-400-700.woff2`
- Modify if generated: `src/assets/fonts/noto-serif-sc-display-700.woff2`

**Interfaces:**
- Produces: documented schema v4 and 59-snapshot coverage
- Produces: ROADMAP stage 5 completion record without claiming polygon coverage

- [ ] **Step 1: Update the human-readable contract**

Rename the contract to v4 and document `GeographicSnapshot`, WGS 84 coordinates, three roles, three precision values, independent `geography.json`, strict build validation, runtime item isolation and the rule that points never imply boundaries.

- [ ] **Step 2: Update product documentation**

README “当前功能” must state:

```text
支持时间轴与离线历史示意地图切换；地图按当前年份展示 20 个世界样本与 15 个中国代表政权的 59 条有来源点位，并与地区、搜索、详情和双政权对比共享状态。点位只表示都城、政治中心或浏览定位，不代表完整疆域。
```

Update counts to schema v4 and 59 geographic snapshots. In ROADMAP, check stage 5 items 1–3 and 5; leave the polygon item 4 unchecked, explicitly label it as later work, and add a completion record describing the point-only MVP and accessible list.

- [ ] **Step 3: Verify font coverage and regenerate only if required**

Run: `npm run check:fonts`

Expected: PASS. If it reports missing characters, run `npm run regen:fonts`, then rerun `npm run check:fonts` and include only changed subset files.

- [ ] **Step 4: Run the full completion gate**

Run each command independently and read its full output:

```bash
npm run validate:data
npm test
npm run typecheck
npm run check:fonts
npm run build
git diff --check
```

Expected:

- strict validation reports 59 geographic snapshots;
- all Vitest files pass with zero failures;
- TypeScript exits 0;
- font coverage exits 0;
- Vite production build exits 0 without online map assets;
- `git diff --check` prints nothing.

- [ ] **Step 5: Perform manual acceptance checks**

At 375px and 1280px, in light and dark system themes:

- switch timeline ↔ map without losing state;
- move through BCE/CE with keyboard and confirm year zero is skipped;
- open a single marker, an overlapping cluster, detail dialog and comparison panel;
- complete the same actions through the result list only;
- simulate geography load failure and retry;
- enable reduced motion and confirm no required information depends on animation;
- confirm Network shows no third-party map/tile requests.

Record any unavailable manual check in the final handoff; do not silently mark it passed.

- [ ] **Step 6: Commit**

```bash
git add docs/data-contract.md README.md ROADMAP.md src/assets/fonts/noto-sans-sc-page-400-700.woff2 src/assets/fonts/noto-serif-sc-display-700.woff2
git commit -m "docs(map): 完成地图阶段说明"
```

---

## Final Review Checklist

- [ ] Every requirement in `docs/superpowers/specs/2026-08-12-offline-historical-map-design.md` maps to a task above.
- [ ] `CrownlineData`, index, detail and geography artifacts all use schema version 4.
- [ ] `index.json` remains geography-free and `geography.json` contains only its source closure.
- [ ] 35 polity IDs, 59 snapshots and nine top-level historical regions are asserted in production integrity tests.
- [ ] Map mode never changes the stored timeline browse mode.
- [ ] Root geography failure and individual bad-record isolation are both tested.
- [ ] Marker and result-list interactions share the same selection output.
- [ ] Polygon/boundary work remains unchecked and undocumented as complete.
- [ ] Full automated and manual completion gates have fresh evidence before completion is claimed.
