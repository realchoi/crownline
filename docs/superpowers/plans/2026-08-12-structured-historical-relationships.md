# 阶段 4B · 结构化历史关系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在双政权时间对比中展示可追溯、可分组、逐条容错的结构化历史关系，并录入覆盖七种关系类型的首批校订数据。

**Architecture:** 继续复用阶段 4A 已加载的双方实体详情分片，在新的纯领域模块中把关系、事件和来源作为不可信候选逐条解析、合并、去重和分组。独立 React 组件只渲染领域模块产生的安全结果；构建期保持严格全量数据校验，浏览器运行时对关系和事件数组放宽为不透明数组，使单条坏记录能进入领域隔离层而不破坏整个详情。

**Tech Stack:** React 19、TypeScript 7、Vitest、Testing Library、JSON Schema 2020-12、现有 JSON 源分片与详情懒加载器。

## Global Constraints

- 历史关系只能来自人工维护的 `relationships` 数据，不从时间重叠、静态中心点或地区标签推断。
- 时间区间为闭区间，不存在公元 0 年。
- “暂无已校订关系数据”只描述数据集覆盖，不得表述为双方没有历史关系。
- 七种首批类型固定为 `war`、`alliance`、`diplomacy`、`tribute`、`vassalage`、`trade`、`cultural-exchange`。
- 每条生产关系至少有一条可解析来源；`low` 或 `disputed` 必须有 `confidenceNote`。
- 单条坏关系或其引用事件只影响该关系；详情根对象、实体 ID、人物和任期错误仍使用现有面板级失败与重试。
- 不新增依赖，不修改 URL 对比协议，不增加独立关系请求端点，不实现地图或完整事件知识图谱。
- 所有行为变更执行 RED → GREEN → REFACTOR；完成前执行 review 与 completion verification。
- 未经用户另行确认，不执行 commit、push、PR 或其他 Git 历史/远程操作。

---

### Task 1: 关系运行时边界与纯领域选择器

**Files:**
- Create: `src/domain/historicalRelationships.ts`
- Create: `tests/historical-relationships.test.ts`
- Modify: `src/data/runtimeValidation.ts`
- Modify: `tests/data-loaders.test.ts`

**Interfaces:**
- Produces: `RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string>`。
- Produces: `CONFIDENCE_LABELS: Record<ConfidenceLevel, string>`。
- Produces: `selectHistoricalRelationships(leftEntityId: string, rightEntityId: string, details: readonly CrownlineDetail[]): HistoricalRelationshipSelection`。
- Produces: `HistoricalRelationshipSelection { groups: HistoricalRelationshipGroup[]; omittedCount: number }`。
- Produces: `HistoricalRelationshipGroup { type: RelationshipType; label: string; relationships: ResolvedHistoricalRelationship[] }`。
- Produces: `ResolvedHistoricalRelationship { relationship: Relationship; events: HistoricalEvent[]; sources: ResolvedRelationshipSource[] }`。
- `ResolvedRelationshipSource` 保存原始 `SourceRef` 与解析后的 `Source`，以便 UI 展示 locator/note。

- [x] **Step 1: 写领域选择器失败测试**

在 `tests/historical-relationships.test.ts` 构造两个最小 `CrownlineDetail` fixture。加入以下具体断言：

```ts
const result = selectHistoricalRelationships("polity-a", "polity-b", [left, right]);

expect(result.groups.map(({ type }) => type)).toEqual(["war", "diplomacy"]);
expect(result.groups[0]?.relationships[0]).toMatchObject({
  relationship: { id: "relationship-a-b-war" },
  events: [{ id: "event-a-b-battle" }],
  sources: [{ source: { id: "source-a-b" } }]
});
```

fixture 同时包含：一条只涉及 `polity-a/polity-c` 的合法记录、双方详情中重复的同 ID 同内容记录、以及年代较晚的第二条战争关系。断言只选择同时含 `polity-a` 与 `polity-b` 的关系，重复项只出现一次，组顺序遵循七类固定顺序，组内按最早起始年排序。

- [x] **Step 2: 运行领域测试并确认 RED**

Run: `npm test -- tests/historical-relationships.test.ts`

Expected: FAIL，原因是 `src/domain/historicalRelationships.ts` 或导出接口不存在。

- [x] **Step 3: 实现最小安全解析与选择逻辑**

在 `src/domain/historicalRelationships.ts`：

```ts
export const RELATIONSHIP_TYPE_LABELS = {
  war: "战争",
  alliance: "联盟",
  diplomacy: "外交",
  tribute: "朝贡",
  vassalage: "臣属",
  trade: "贸易",
  "cultural-exchange": "文化交流"
} satisfies Record<RelationshipType, string>;

export const CONFIDENCE_LABELS = {
  high: "高可信度",
  medium: "中等可信度",
  low: "低可信度",
  disputed: "存在争议"
} satisfies Record<ConfidenceLevel, string>;
```

实现局部 `isRecord`、非空字符串、合法历史日期/区间、参与方、来源引用、事件和关系收窄函数。不得把一次性一两行表达式拆成转发 helper；只抽取能隔离复杂解析边界的函数。候选来源为 `details.flatMap(detail => detail.relationships) as unknown[]`，事件和来源也从双方详情合并为 ID map。

同 ID 候选使用 `JSON.stringify` 比较规范化前的完整内容：内容一致只保留一个；内容冲突整组 ID 隔离并使 `omittedCount += 1`。与当前配对无关但结构合法的关系不计入省略；结构坏且无法判定参与方的候选计入省略。只有匹配当前配对的候选才解析来源与事件。

- [x] **Step 4: 重跑领域测试并确认 GREEN**

Run: `npm test -- tests/historical-relationships.test.ts`

Expected: PASS。

- [x] **Step 5: 增加逐条容错失败测试**

为以下每种坏候选建立表驱动用例，并与一条有效战争关系共同输入：未知类型、重复参与方、反向区间、公元 0 年、空摘要、`disputed` 无说明、空来源、悬空来源、悬空事件、坏事件对象、同 ID 内容冲突。

```ts
expect(result.groups.flatMap(({ relationships }) => relationships)
  .map(({ relationship }) => relationship.id)).toEqual(["relationship-valid"]);
expect(result.omittedCount).toBe(1);
```

- [x] **Step 6: 增加运行时详情容错失败测试**

在 `tests/data-loaders.test.ts` 向唐详情的 `relationships` 放入 `{ broken: true } as never`，向 `events` 放入 `{ id: 42 } as never`。断言 `validateCrownlineDetail` 仍返回 `{ valid: true, issues: [] }`，而把 `relationships` 或 `events` 根字段改为对象时仍返回对应 `SCHEMA_ERROR`。

- [x] **Step 7: 放宽关系与事件的运行时数组边界**

在 `src/data/runtimeValidation.ts` 为 `relationships` 和 `events` 使用只验证根值为数组的读取函数，不再在详情加载阶段遍历其项目、事件引用和关系来源引用。保留 `persons`、`reigns`、`reignVacancies`、`sources` 现有严格校验及其来源闭包检查。构建期 `validateCrownlineData` 和 JSON Schema 完全不放宽。

- [x] **Step 8: 重跑 Task 1 测试**

Run: `npm test -- tests/historical-relationships.test.ts tests/data-loaders.test.ts`

Expected: PASS；人物、任期与来源闭包既有拒绝用例继续通过。

---

### Task 2: 七类首批关系、事件与可追溯来源

**Files:**
- Modify: `src/data/source/relationships/relationships.json`
- Modify: `src/data/source/events/events.json`
- Modify: `src/data/source/sources/sources.json`
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/data-artifacts.test.ts`

**Interfaces:**
- Produces: 七条 `Relationship` 生产记录，覆盖全部 `RelationshipType`。
- Produces: 四条 `HistoricalEvent`：曼齐克特战役、海上之盟、唐蕃长庆会盟、黑石号沉船所代表的海上贸易证据。
- Produces: 七项关系专用来源记录，全部使用稳定 ID 和 `accessedAt: "2026-08-12"`。

- [x] **Step 1: 写生产数据覆盖失败测试**

在 `tests/data-integrity.test.ts` 添加：

```ts
expect(new Set(data.relationships.map(({ type }) => type))).toEqual(
  new Set(RELATIONSHIP_TYPES)
);
expect(data.relationships).toHaveLength(7);
expect(data.events).toHaveLength(4);
expect(data.relationships.every(({ sourceRefs }) => sourceRefs.length > 0)).toBe(true);
```

逐条断言以下 ID、参与方和事件引用：

- `relationship-byzantine-seljuk-manzikert-war`
- `relationship-northern-song-jurchen-jin-alliance`
- `relationship-tang-tibet-changqing-diplomacy`
- `relationship-tang-balhae-tribute`
- `relationship-yuan-goryeo-vassalage`
- `relationship-tang-abbasid-maritime-trade`
- `relationship-tang-balhae-cultural-exchange`

在 `tests/data-artifacts.test.ts` 断言同一关系及其事件、来源同时进入双方详情，且无关实体详情不包含该关系。

- [x] **Step 2: 运行数据测试并确认 RED**

Run: `npm test -- tests/data-integrity.test.ts tests/data-artifacts.test.ts`

Expected: FAIL，因为生产关系与事件数组当前为空。

- [x] **Step 3: 录入关系专用来源**

在 `src/data/source/sources/sources.json` 追加以下精确来源记录；`citation` 使用标题、作者/机构、出版物和年份组成完整书目，不复制网页长段落：

```text
source-worldhistory-manzikert
  World History Encyclopedia, “Battle of Manzikert”, 2018
  https://www.worldhistory.org/article/1189/battle-of-manzikert/

source-cambridge-song-jin-alliance
  Cambridge University Press, The Cambridge History of Chinese Literature,
  “North and south: the twelfth and thirteenth centuries”, 2011
  https://www.cambridge.org/core/books/abs/cambridge-history-of-chinese-literature/north-and-south-the-twelfth-and-thirteenth-centuries/61601DC54708F14962001A8CCF558427

source-li-tang-tibet-treaty
  Fang-Kuei Li, “The Inscription of the Sino-Tibetan Treaty of 821-822”,
  T'oung Pao 44(1), 1956, pp. 1–99
  https://doi.org/10.1163/156853256X00018

source-kci-balhae-tang-tribute
  Kim Jongbok, “A Basic Examination on the Balhae and Malgal Tribes’
  Relations with Tang in 8th Century”, 역사문화연구 39, 2011, pp. 33–66
  https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART001562385

source-history-korea-goryeo-mongol
  National Institute of Korean History, A History of Korea,
  Chapter 5 “Goryeo and the Mongol Empire”, 2020
  https://contents.history.go.kr/resources/common/pdf/A%20History%20of%20Korea_The%20Understanding%20Korea%20Series.pdf

source-aga-khan-lost-dhow
  Aga Khan Museum, “The Lost Dhow: A Discovery from the Maritime Silk Route”
  https://agakhanmuseum.org/whats-on/the-lost-dhow-a-discovery-from-the-maritime-silk-route/

source-history-korea-balhae-culture
  National Institute of Korean History, A History of Korea,
  Balhae culture and regional exchange sections, 2020
  https://contents.history.go.kr/resources/common/pdf/A%20History%20of%20Korea_The%20Understanding%20Korea%20Series.pdf
```

来源类型依次使用 `secondary`、`secondary`、`secondary`、`secondary`、`institutional`、`institutional`、`institutional`。两个韩国史来源允许 URL 相同，但 citation 和 ID 分别说明所支持的关系概念。

- [x] **Step 4: 录入四条代表事件**

在 `src/data/source/events/events.json` 添加：

```text
event-battle-of-manzikert
  type=battle, 1071–1071
  participants=polity-byzantine-empire, polity-seljuk-empire

event-alliance-conducted-at-sea
  type=treaty, 1120–1120
  participants=polity-cn-northern-song, polity-cn-jin

event-tang-tibet-changqing-treaty
  type=treaty, 821–822
  participants=polity-cn-tang, polity-tibet-empire

event-belitung-shipwreck
  type=other, circa 830–circa 830
  participants=polity-cn-tang, polity-abbasid-caliphate
```

每条事件使用对应关系来源，`regionIds` 分别使用现有西亚/欧洲、中国/东亚等有效地区 ID。黑石号事件摘要必须说明其为唐代商品进入阿拔斯时期海上贸易网络的考古证据，不表述为两国政府直接组织贸易。

- [x] **Step 5: 录入七条关系**

在 `src/data/source/relationships/relationships.json` 按类型顺序添加：

```text
war: Byzantine–Seljuk, 1071, high
  roles=交战方/交战方, event=event-battle-of-manzikert

alliance: Northern Song–Jurchen Jin, 1120–1122, high
  roles=盟约方/盟约方, event=event-alliance-conducted-at-sea

diplomacy: Tang–Tibetan Empire, 821–822, high
  roles=缔约方/缔约方, event=event-tang-tibet-changqing-treaty

tribute: Tang–Balhae, 713–800, disputed
  roles=册封与受贡方/遣使与入贡方
  confidenceNote=“朝贡”只描述唐代册封、遣使和礼仪框架；不据此把渤海解释为唐的地方行政单位或放弃其对内、对外自主性。

vassalage: Yuan–Goryeo, 1271–1356, medium
  roles=宗主政权/保留王统的附属王国
  confidenceNote=高丽保留王室和相当程度的内部治理，本记录描述元廷通过婚姻、驻军、征东行省等机制施加的附属关系，不等同于直接撤销高丽政权。

trade: Tang–Abbasid, circa 830, medium
  roles=贸易网络东端政权/贸易网络西端政权, event=event-belitung-shipwreck
  confidenceNote=沉船与器物证明跨区域贸易网络及商品流通，不证明贸易由唐与阿拔斯中央政府直接缔约或经营。

cultural-exchange: Tang–Balhae, 713–907, medium
  roles=制度与文化参照方/吸收与重构方
  confidenceNote=渤海对唐制度和文化要素的吸收是在自身高句丽、靺鞨传统上进行的选择性重构，不表示文化同一或政治从属。
```

所有摘要使用中性、可追溯表述，不把礼仪关系、考古商品流通或文化影响夸大为主权隶属和国家直接行为。

- [x] **Step 6: 运行数据生成与定向测试**

Run: `npm run validate:data`

Expected: 输出数据校验成功，7 条关系、4 条事件和新增来源引用全部闭合。

Run: `npm test -- tests/data-integrity.test.ts tests/data-artifacts.test.ts`

Expected: PASS。

---

### Task 3: 历史关系界面与对比台集成

**Files:**
- Create: `src/components/HistoricalRelationships.tsx`
- Modify: `src/components/ComparisonPanel.tsx`
- Modify: `src/styles/styles.css`
- Modify: `tests/app.test.tsx`

**Interfaces:**
- Produces: `HistoricalRelationships({ left, right, details }: HistoricalRelationshipsProps)`。
- Consumes: `selectHistoricalRelationships(left.id, right.id, details)`。
- `ComparisonPanel` 在双方详情 ready 后，把两份详情和两个实体传给该组件。

- [x] **Step 1: 写真实数据界面失败测试**

在 `tests/app.test.tsx` 添加三组用例：

1. URL 选择拜占庭帝国和塞尔柱帝国，断言时间关系区块仍存在，独立关系区块显示“已校订历史关系”“战争”“曼齐克特”、1071、双方“交战方”、可信度、相关事件及来源链接。
2. URL 选择唐和渤海，断言同时出现“朝贡”“文化交流”，显示两条争议/口径说明和来源。
3. URL 选择没有生产关系的秦和明，断言显示“暂无已校订关系数据”和“不代表双方历史上没有关系”。

链接断言使用：

```ts
expect(within(relationships).getByRole("link", { name: /查看来源/ }))
  .toHaveAttribute("target", "_blank");
```

- [x] **Step 2: 运行 App 定向测试并确认 RED**

Run: `npm test -- tests/app.test.tsx`

Expected: FAIL，因为对比台尚无历史关系区块。

- [x] **Step 3: 实现关系展示组件**

创建 `HistoricalRelationships.tsx`，根元素使用：

```tsx
<section className="historical-relationships" aria-labelledby="historical-relationships-title">
  <header>
    <p>阶段 4B · 人工校订</p>
    <h3 id="historical-relationships-title">已校订历史关系</h3>
    <span>与上方自动计算的时间关系分开呈现</span>
  </header>
  {/* groups / empty state / omitted warning */}
</section>
```

每组使用 `<section aria-labelledby>`，每条关系使用 `<article>`。区间使用现有 `formatPeriods`；参与角色按当前 A/B 实体名称展示；可信度同时渲染文字标签。相关事件用 `<ul>`；来源放在 `<details><summary>来源 · N 项</summary>` 中，显示 citation 与 locator/note，有 URL 时渲染 `target="_blank" rel="noreferrer"` 链接。

- [x] **Step 4: 集成到 ComparisonPanel**

在 `ComparisonPanel.tsx` 的 `comparison-columns` 之后、加载/错误状态之前，仅当 `readyDetails` 存在时渲染：

```tsx
<HistoricalRelationships
  left={comparison.left}
  right={comparison.right}
  details={readyDetails}
/>
```

把面板 kicker 从“阶段 4A · 时间关系”调整为“阶段 4 · 时间与历史关系”，但保留时间摘要内的“时间关系”标签。无交集文案移除“关系数据将在阶段 4B 单独校订”，改为“这不表示双方没有历史关系；请查看下方已校订记录。”

- [x] **Step 5: 增加逐条坏数据界面失败测试**

使用 `renderApp` 自定义 `loadDetail`，向双方之一的关系数组加入一条 `{ broken: true } as never`，同时保留一条有效关系。断言有效关系正常显示、页面仍有双方统治者，并出现“有 1 条关系数据格式异常，已跳过”。

- [x] **Step 6: 完成非阻断提示与样式**

在 `src/styles/styles.css` 新增 `.historical-relationships`、`.relationship-group`、`.relationship-card`、`.relationship-meta`、`.relationship-participants`、`.relationship-events`、`.relationship-sources`、`.relationship-empty`、`.relationship-warning`。保持单列正文；卡片边框、背景和间距复用现有变量；`disputed/low` 标签同时包含文字和边框差异。760px 与既有移动断点下缩小 padding，不改变阅读顺序。

- [x] **Step 7: 重跑 App 与领域测试**

Run: `npm test -- tests/app.test.tsx tests/historical-relationships.test.ts`

Expected: PASS；现有详情加载重试、迟到请求保护、统治者和 URL 选择用例不回归。

---

### Task 4: 产品文档与路线图收尾

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `docs/data-contract.md`

**Interfaces:**
- Documentation only；不改变运行时接口。

- [x] **Step 1: 更新 README 当前能力与数据统计**

在“当前功能”增加：双政权对比按类型显示有来源的战争、联盟、外交、朝贡、臣属、贸易和文化交流；无记录不等于没有关系；坏记录逐条隔离。把数据统计更新为实际生成后的来源、关系和事件数量，并在“发展路线”把阶段 4B 标记为已完成。

- [x] **Step 2: 更新数据契约的人类可读规则**

在 `docs/data-contract.md` 第 5–7 节补充：

- 关系必须至少一项来源；
- 礼仪性朝贡与政治臣属不可互相替代；
- 贸易和文化交流不得从单一器物或风格相似性推断为政府条约；
- 运行时逐条容错不放宽构建期 Schema 与语义校验；
- 记录当前关系、事件和来源实际数量。

- [x] **Step 3: 勾选 ROADMAP 阶段 4B**

勾选阶段 4B 五项，并添加 2026-08-12 完成记录，写明：复用双方详情分片、七类首批记录、四条代表事件、来源/争议展开、逐条容错、无数据口径以及未推断疆域关系。

- [x] **Step 4: 检查新增汉字字体覆盖**

Run: `npm run check:fonts`

Expected: PASS。若只因本阶段新增文案或史料名称缺字而失败，运行 `npm run regen:fonts` 重新生成 `src/assets/fonts/` 中三个 WOFF2 子集，再重跑检查；不得手工编辑二进制字体。

---

### Task 5: Review 与完成前验证

**Files:**
- Review all task-related changes

**Interfaces:**
- Produces: 可复核的测试、构建、数据和差异证据。

- [x] **Step 1: 对照设计进行实现自审**

逐项核对：时间与人工关系分层；七种类型；来源和事件解析；朝贡、臣属、贸易及文化关系的限制性说明；无数据措辞；坏关系隔离；没有新增关系请求、URL 参数、依赖或地图推断。

- [x] **Step 2: 执行完整数据校验和测试**

Run: `npm run validate:data`

Expected: PASS，输出实际实体、关系、事件和来源总数。

Run: `npm test`

Expected: PASS，所有 Vitest suites 无失败。

- [x] **Step 3: 执行静态检查和生产构建**

Run: `npm run typecheck`

Expected: exit 0，无 TypeScript diagnostics。

Run: `npm run build`

Expected: exit 0，Vite 成功生成 `dist/`。

- [x] **Step 4: 执行字体与差异检查**

Run: `npm run check:fonts`

Expected: PASS。

Run: `git diff --check`

Expected: 无输出，exit 0。

Run: `git status --short`

Expected: 只列出本计划涉及的源码、测试、数据、字体（若确有缺字）和文档；生成目录不进入变更。

- [x] **Step 5: 使用 requesting-code-review 与 verification-before-completion 收尾**

按专项技能复核需求覆盖和代码质量，修复发现后重跑受影响测试及完整验证。只有拿到最新一轮成功输出后，才能声明阶段 4B 已落地。提交、推送或创建 PR 继续等待用户单独授权。
