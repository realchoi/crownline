# Crownline 数据契约 v1

本契约是阶段 0.5 的长期数据边界。机器可读定义以 `src/data/crownline-data.schema.json` 为准，TypeScript 消费端以 `src/domain/types.ts` 为准；本文解释两者共同采用的历史口径。

## 1. ID 与引用

- 所有阶段、实体、地区、人物、任期、关系、事件和来源使用稳定 ASCII kebab-case ID。
- ID 在整个数据文件中全局唯一；显示名称可以修改，引用不得依赖名称或数组位置。
- 任期引用人物与政权，关系引用参与政权和可选事件，事件引用参与政权和地区，所有记录通过 `sourceRefs` 引用来源。

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

## 5. 人物、任期、关系与事件

- `persons` 保存人物本身；`reigns` 通过一个或多个区间记录人物在某政权的统治、共治、摄政或争位身份。
- `relationships` 记录战争、联盟、外交、朝贡、臣属、贸易或文化交流，必须至少有两个不重复的参与政权。
- `events` 是可选的结构化历史事件，可连接政权、地区和关系；本阶段不要求建立完整事件知识图谱。
- 任期、关系与事件都使用同一套历史区间、来源引用和可信度规则。

当前迁移数据尚未填充人物、任期、关系和事件实例，但数组与契约已就位，后续阶段可在不破坏实体模型的前提下增量补充。

## 6. 来源与可信度

- `sources` 集中保存书目或机构来源，业务记录通过 `sourceRefs` 引用，可补充页码、章节或注释。
- `confidence` 可为 `high`、`medium`、`low` 或 `disputed`。
- `low` 与 `disputed` 必须填写 `confidenceNote`，避免把不确定数据呈现为确定事实。

## 7. 校验边界

JSON Schema 校验必填字段、封闭对象、枚举、ID 格式、非零年份和基本数组约束。`src/domain/dataValidation.ts` 进一步校验：

- 全局重复 ID
- 反向、重叠或可合并的相邻区间
- 阶段、人物、政权、地区、事件和来源的悬空引用
- 政权与历史分期的分类矛盾
- 关系中重复参与方
- 争议年代或低可信度记录缺少说明

修改数据后运行：

```bash
npm run validate:data
npm test
```

运行时加载数据时也会执行相同校验；坏数据不会静默进入界面。
