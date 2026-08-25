# Crownline 数据契约 v5

本契约在 v4 的统治者、任期、关系、事件和点位地理快照之上，加入带适用时间、精度、来源、许可和 GeoJSON `MultiPolygon` 的简化疆域快照。机器可读定义以 `src/data/crownline-data.schema.json` 为准，TypeScript 消费端以 `src/domain/types.ts` 为准；本文解释两者共同采用的历史口径。

## 0. 源分片与运行时产物

人工维护数据位于 `src/data/source/`，不再维护单一完整 JSON。每个实体分片包含唯一正整数 `order`、一个主实体，以及优先归属于该实体的人物、任期与明确空位；阶段、地区、来源、关系和事件单独分片。所有记录聚合后仍遵循本契约，并共享单一全局 ID 命名空间。

`npm run generate:data` 按 `order` 聚合实体分片，执行 JSON Schema 和跨记录语义校验，然后加载 `src/data/source/coverage/coverage-review.json`，最后生成首屏 `index.json`、按实体加载的详情包、点位 `geography.json` 和独立疆域 `boundaries.json`。疆域坐标只进入 `boundaries.json`，不进入首屏索引、详情或点位包。生成过程同时在 `.generated/data/coverage-report.json` 写出确定性的覆盖报告 v2；覆盖审查目录只供维护工具使用，不进入任何浏览器产物。`.generated/` 和 `public/data/generated/` 都是可重建产物，不得手工修改或提交。浏览器的窄校验只防止部署缺失或文件错配，不能替代生成阶段的全量校验。

<!-- crownline-data-stats:start -->
当前数据快照：133 个实体（131 个政权、2 个历史分期）、1335 位人物、1374 条任期、28 条结构化关系、18 个事件、172 条地理快照、8 条疆域快照、190 项来源。
<!-- crownline-data-stats:end -->

截至 2026-08-22 的扩容批次和地图样本说明保留在历史记录中；当前可机器校验的数据摘要见上方标记区块。疆域试点与来源审查见 [`docs/boundary-pilot.md`](boundary-pilot.md)。新增点位仍只表示历史地点浏览定位；新增疆域也只是带年份的简化示意。

## 1. ID 与引用

- 所有阶段、实体、地区、人物、任期、空位、关系、事件、地理快照和来源使用稳定 ASCII kebab-case ID。
- ID 在全部源分片聚合后全局唯一；显示名称可以修改，引用不得依赖名称或数组位置。
- 任期引用人物与政权，关系引用参与政权和可选事件，事件引用参与政权和地区，所有记录通过 `sourceRefs` 引用来源。

名称对象始终包含中文界面主名称 `primary` 与别名数组 `aliases`。可选的本地名称 `local` 必须与 `localLanguageTag` 成对出现；语言标签采用 BCP 47，界面据此帮助辅助技术选择发音语言，并用 `dir="auto"` 处理从右到左文字。无法可靠恢复历史自称时不填本地名称，不以现代国名或推测转写补位。多文字体系原名使用系统字体回退，不进入中文页面字体子集。

## 2. 实体分类与展示分类

`entityKind` 表达数据实体的本质：

- `polity`：政治实体
- `historical-period`：用于浏览的历史分期

`polityForms` 仅描述政权形态，如 `dynasty`、`empire`、`kingdom`、`khanate`、`state`。历史分期不得填写政权形态。

`displayCategory` 只控制当前时间轴的视觉层级：`mainline`、`contemporary`、`regional`、`context`。它不替代实体分类，因此“是不是政权”和“页面怎样展示”可以独立演进。

## 3. 历史年份与区间

- 公元前年份使用负整数，公元后使用正整数，不允许 0。
- 所有区间的起止端点均包含。
- 年份筛选的语义是“该实体在这一历史年份内任一时刻存在”。
- `precision` 可为 `exact`、`circa`、`decade`、`century` 或 `unknown`。
- 一个实体可以有多个按时间升序排列、互不重叠的 `existencePeriods`。相邻区间必须合并，以免制造没有意义的切段。
- 争议口径使用 `chronologyStatus: "disputed"` 并填写 `chronologyNote`；替代口径放入 `alternativeChronologies`，且必须附来源。

当前数据中，西秦使用 `385—400` 与 `409—431` 两段，唐使用 `618—690` 与 `705—907` 两段。持续时间只累加实际存在区间，不包含中断期。

## 4. 地区职责

- `historical-region`：历史语境下的空间单元，可随时代演进。
- `cultural-sphere`：跨政治边界的文化联系与传统，不等同于领土。
- `modern-area`：便于当代检索和筛选的现代地理映射，不反推历史主权。

实体分别通过 `historicalRegionIds`、`culturalSphereIds` 与 `modernAreaIds` 引用三类地区，三者不可互相替代。

地区使用与实体相同的 `names.primary`、`names.aliases` 与可选 `names.local` 名称结构；`parentRegionId` 只允许引用同类地区，并且不得形成循环。阶段 2 只根据 `historicalRegionIds` 过滤：选择父地区时包含其全部后代，多地区之间采用并集语义，同一实体不会因关联多个地区而重复。

`coverage.status` 只说明当前数据集：

- `none`：尚未收录代表性条目。
- `sample`：只有用于验证模型的少量代表条目。
- `partial`：已有成体系内容，但仍不声称完整覆盖。

每个状态必须带 `coverage.note`。项目不提供“完整”状态，避免把资料收录程度误写成真实历史完整性。“中国历史范围”是产品策展预设，不等同于任何时期的现代国界或主权范围。

截至 2026-08-12，美洲、东南亚、中亚与西非均已具备 `sample` 覆盖；中国相关地区保持 `partial`。这些状态只描述当前数据集，不表示对应地区历史上是否存在更多政权或是否已经完成通史覆盖。

## 5. 人物、任期、空位、关系与事件

- `persons` 保存人物本身；`reigns` 通过一个或多个区间记录人物在某政权的统治、共治、摄政或争位身份。`titles` 保存通用称号，可选 `localTitles` 保存当地称谓。
- 任期区间必须完整落在所引用政权的某一个存在分段内，不能跨越政权中断期；同一人物复立时使用一条任期的多个区间。
- `reignVacancies` 只记录有来源明确支持的无在位统治者时段，不能与任期或同政权的其他空位重叠。没有任期且没有空位记录的年份表示“资料尚未校订”，不得推断为历史上的空位。
- `relationships` 记录战争、联盟、外交、朝贡、臣属、贸易或文化交流，必须至少有两个不重复的参与政权，并至少引用一项能直接支持关系类型、双方和时间口径的来源。
- 关系和事件至少要与每个参与实体的某一段存续期相交；完全错位通常表示政权 ID 误连，构建期必须拒绝。
- 朝贡描述册封、遣使、贡物等礼仪与外交框架，不能自动等同于政治臣属；臣属记录也必须说明保留自治、王统或直接统治的具体边界。
- 贸易与文化交流可以使用考古和物质文化证据，但不能从单一器物、风格相似或商品出现地点推断政府间条约、中央经营或主权关系。
- `events` 是可选的结构化历史事件，可连接政权、地区和关系；本阶段不要求建立完整事件知识图谱。
- 任期、空位、关系与事件都使用同一套历史区间、来源引用和可信度规则。

历史进展记录（2026-08-23）：数据深度批次完成中国地图点位、关系和关联事件补充；关系仍只代表已校订案例，不表示任意政权组合都已完成关系整理。新增关系和事件的来源引用提供章节、页码或页面内定位，贸易与文化交流保留网络证据边界。大津巴布韦王国与特奥蒂瓦坎完成正式资料审查，均保持 `reviewed-unavailable`；没有可可靠对应的具名、带任期统治者时，不新增人物、任期或空位。详细审查说明见 `docs/ruler-gap-review.md`。没有统治序列不表示无人统治，没有关系记录也不表示两个政权之间没有关系。当前总数以本节上方机器维护区块为准。

## 5.1 覆盖审查与报告 v2

`src/data/source/coverage/coverage-review.json` 是独立于运行时契约的工具侧人工审查目录。每条记录通过稳定 `entityId` 指向一个真实政权，并指定 `rulerDetails`、`localNames` 或 `geography` 维度。历史分期、悬空实体、重复的实体/维度组合、未知状态、空 `note` 和与业务数据冲突的状态都会阻止校验与生成。

四种状态含义如下：

- `available`：业务数据已有可展示内容，由构建逻辑自动判定，不要求人工重复登记。
- `reviewed-unavailable`：已经审查，但当前无法可靠补充；这不是“历史上不存在”的断言。
- `not-applicable`：该维度对当前实体不适用，或重复填写没有信息价值；它不进入 `applicableTotal`。
- `pending-review`：没有业务数据且尚未完成审查。

报告中的 `availablePercentage` 使用适用政权数（总数减 `notApplicable`）作为分母；`reviewedPercentage` 表示已有明确结论（包括 `not-applicable`）的政权比例。三项维度的缺口数组按状态列出实体 ID，并使用稳定排序。新增字段或数据批次时，先补业务源数据和来源，再判断是否已经自动进入 `available`；只有有明确审查依据的缺失项才写入特殊状态，其余保持缺省的 `pending-review`。不得按地区或名称语言机械推断 `not-applicable`。

关系不是普通字段覆盖率。`relationshipSummary` 只描述已收录关系案例的数量、参与政权去重数量、关系类型、可信度和顶层地区分布；`participantPercentage` 的含义是“参与已收录关系的政权比例”，不能称为关系完成率，也不能从无记录推断历史上没有关系。跨地区政权或跨地区关系按其实际地区绑定进入相关顶层地区；不生成全部未参与政权的组合缺口列表。

## 6. 地理快照

`GeographicSnapshot` 用一条独立记录描述某政权在一个或多个时期内可用于浏览定位的历史地点：

- `polityId` 只能引用真实政权，不能引用历史分期。
- `periods` 采用与实体相同的不含公元 0 年、两端包含的历史区间，并且每一段必须完整落在政权的一段存在期内。
- `coordinates` 使用 WGS 84 十进制度；`latitude` 范围为 -90 至 90，`longitude` 范围为 -180 至 180。
- `role` 只能是 `capital`（都城）、`political-center`（政治中心）或 `representative-center`（代表性中心）。
- `positionPrecision` 只能是 `exact`、`approximate` 或 `regional`，用于说明现代坐标与历史地点对应关系的定位精度。
- `positionNote` 必须披露点位含义和限制；`sourceRefs` 至少同时支撑历史地点口径与现代坐标映射。
- 同一政权可以在相邻时期使用不同点位，也可以在同一时期保留多个有来源的中心；中断或迁都不能用一条无间断区间掩盖。

地理点位只表示都城、政治中心或浏览定位点，不表示政权疆域、边界、中心权重、控制范围或现代主权。不得据点位距离推断接壤、重叠、战争、外交或臣属关系。当前离线地图采用 Natural Earth 陆地轮廓作为纯背景，不包含现代政治边界。

构建期对全部地理记录执行严格 Schema 和语义校验，包括坐标范围、时期、政权类型、来源闭包、重复 ID 与重复语义记录。运行时先严格校验 `geography.json` 根对象、版本和来源数组，再逐条收窄快照；单条损坏记录会被跳过并计数，根对象损坏则整份地图数据不可用。运行时隔离不放宽构建期标准。

地理覆盖进展（2026-08-25）：现有 131 个真实政权中，130 个至少有一条可展示地理快照；夏因夏—二里头及传统都邑对应仍有争议，完成正式审查后标为 `reviewed-unavailable`，不以单一候选地点填补覆盖率。地理维度已无 `pending-review`，审查结论见 [`docs/geography-gap-review.md`](geography-gap-review.md)。这一覆盖率只表示每个政权是否至少存在一条可展示记录，不表示所有年份、迁都阶段或竞争性重建均已完成。

## 6.1 疆域快照

`GeographicBoundarySnapshot` 只表示某政权在指定时间范围内的一套采用疆域示意，不从点位推导，也不覆盖政权的其他年份：

- `polityId` 必须引用 `entityKind: "polity"`，不能引用历史分期；每个 `period` 必须完整落在某一段政权存在期内，不允许公元 0 年、倒置、相邻可合并区间或同一政权同年多套采用快照。
- `geometry` 必须严格是 GeoJSON `MultiPolygon`；单块疆域也使用只含一个 polygon 的结构。位置顺序固定为 `[longitude, latitude]`，环至少 4 个位置、首尾完全相同、非零近似面积，不接受连续重复坐标、自交、越界、非有限数值或未预先拆分的反经线几何。洞环保留在对应 polygon 内并须落在外环内。
- `boundaryPrecision` 只能是 `schematic`、`approximate` 或 `reconstructed`，不提供 `exact`。`boundaryNote` 必须说明采用口径、适用时间和示意限制。
- `provenance` 至少包含数据集名称、署名、许可名称、许可地址、来源地址和可复现处理说明。生产坐标不得来自许可不清或不允许派生坐标的资料。
- 每条记录至少引用一个现有来源；低可信度或争议记录必须有 `confidenceNote`。运行时只保留来源闭包完整且几何安全的记录，坏记录计数隔离。

疆域快照明确是公开资料基础上的重建或简化历史空间示意，不代表整个政权存续期、现代主权、范围内地点的同等控制或精确面积/距离/边界分析。边缘地区可能存在羁縻、间接统治、附属关系、争议或资料不确定性。两个多边形视觉上相交也不会生成接壤、空间重叠、战争、外交、臣属或领土得失结论；本 MVP 不实现任何空间关系推断、面积比较、连续年份插值或竞争性重建版本切换。

疆域按需加载：只有地图图层切换为 `layer=boundaries` 或 `layer=combined` 才请求 `boundaries.json`。全时期总览不会把跨时代疆域叠加；用户必须选择明确年份。地图下方结果列表包含政权、适用时期、精度、可信度、边界说明、详情和对比入口，是手机和键盘用户的等价核心界面。预算由 `npm run check:boundaries` 固定检查：原始不超过 500 KB、gzip 不超过 150 KB、总坐标位置不超过 1,200、单条不超过 180 个位置、试点不超过 10 条。

## 7. 来源与可信度

- `sources` 集中保存书目或机构来源，业务记录通过 `sourceRefs` 引用，可补充页码、章节或注释。
- `confidence` 可为 `high`、`medium`、`low` 或 `disputed`。
- `low` 与 `disputed` 必须填写 `confidenceNote`，避免把不确定数据呈现为确定事实。

覆盖报告还按 `sourceType` 统计来源等级，并分别统计 URL 与 `accessedAt` 是否非空。关系、事件和地理快照的 `sourceReferenceQuality` 统计记录是否有来源引用，以及是否至少有一个非空 `locator`；空白定位不算已定位。所有来源类型和可信度枚举都会在报告中出现，即使数量为 0。

## 8. 四层校验边界

四层保护各有职责，不能互相替代：

1. `src/data/crownline-data.schema.json` 是完整机器结构契约，校验必填字段、封闭对象、枚举、ID 格式、非零年份和基本数组约束。
2. `src/domain/types.ts` 描述应用与生成器在编译期消费的静态形状；`CROWNLINE_SCHEMA_VERSION` 同时固定类型和运行时支持版本。
3. `src/domain/dataValidation.ts` 在生成和发布前执行完整的跨记录语义校验，包括：

- 全局重复 ID
- 反向、重叠或可合并的相邻区间
- 阶段、人物、政权、地区、事件和来源的悬空引用
- 任期与明确空位引用政权的类型、存在区间边界，以及两者之间的重叠冲突
- 地区父引用悬空、跨类型或形成循环，以及实体混用三类地区引用
- 政权与历史分期的分类矛盾
- 关系中重复参与方
- 争议年代或低可信度记录缺少说明
- 地理快照引用历史分期、越出政权存在期、坐标越界、缺少位置说明或形成重复语义记录。

4. `src/data/runtimeValidation.ts` 是浏览器包中的窄校验，不引入完整 Schema 或 Ajv。首屏索引严格检查时间轴、实体、地区、纪年策略以及当前筛选、时间轴、时间点和详情基础信息会立即读取的字段；详情严格检查人物、任期、明确空位、来源闭包和请求实体 ID；点位地理和疆域数据分别严格检查根对象、版本和来源。

覆盖审查数据不属于上述浏览器四层契约。`validate:data` 和 `generate:data` 会在聚合后的 `CrownlineData` 校验通过后独立加载它；文件缺失、JSON 损坏、结构错误、悬空政权、历史分期、重复记录或状态冲突都会失败。覆盖报告写入 `.generated/data/coverage-report.json`，不会扩展运行时 Schema v5 的 `CrownlineIndex`、`CrownlineDetail`、`CrownlineGeography` 或 `CrownlineBoundaries`。

关系和事件继续作为详情根数组存在，但由历史关系领域层逐条收窄，因为单条校订记录损坏不应阻止双方时间对比和统治者展示。点位地理与疆域快照同理逐条隔离：根对象、版本或来源数组损坏会使对应地图包加载失败，单条记录损坏只计入跳过数量，从而保留其余可用数据。这个容错策略只用于部署时故障隔离，不放宽构建期的完整 Schema 与语义要求。

`tests/runtime-contract.test.ts` 使用生成器真实产物验证 index、全部 detail 与 geography 均通过运行时校验；同时固定 UI 必需字段缺失、本地名称与 BCP 47 标签配对，以及 JSON Schema、TypeScript 常量、生成产物和运行时支持版本的一致性。Schema 版本改变时必须同步修改所有层，否则测试会显式失败。

新增 UI 必需字段时，需要同步完成：

- 在 JSON Schema 中声明字段、必填性与结构约束；
- 在 `src/domain/types.ts` 中更新对应 TypeScript 类型；
- 若字段涉及跨记录含义，在 `src/domain/dataValidation.ts` 增加语义规则；
- 在 `src/data/runtimeValidation.ts` 的相应 index、detail、geography 或 boundaries 窄边界中验证 UI 实际读取的最小安全结构；
- 在生成产物契约测试中增加“有效产物通过、字段缺失被拒绝”的回归用例。

修改数据后运行：

```bash
npm run validate:data
npm test
```

README、本文档和 `ROADMAP.md` 的当前数据摘要使用 `crownline-data-stats` 标记区块。`npm run check:docs` 只比较这些当前区块，不检查路线图中的历史进展数字，也不会自动改写文档；需要更新时应显式修改区块并重新运行检查。

构建期必须完整执行上述 Schema 与语义校验，错误数据不得发布；运行时隔离也不得被当作数据维护阶段的容错捷径。
