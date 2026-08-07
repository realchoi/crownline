# Crownline 数据分片与详情懒加载设计

## 1. 背景与目标

当前生产数据集中保存在 `src/data/crownline-data.json`。该文件已有 77 个实体、177 个人物和 177 条任期记录，共 11,031 行；继续补充政权、统治者、关系、事件与来源后，单文件维护、审查和冲突处理成本会持续上升。

本次改造同时完成三个目标：

1. 将人工维护的数据按稳定业务边界拆分，避免继续编辑单一巨型 JSON。
2. 在构建阶段聚合全部分片，并复用现有 JSON Schema 与语义校验保证全局引用完整。
3. 将运行时数据拆为首屏索引和按实体加载的详情包，减少首屏携带的人物、任期和来源数据。

本次不引入数据库、CMS、服务端 API、客户端路由或新的状态管理依赖。站点继续作为 Vite 静态应用部署到 GitHub Pages。

## 2. 方案选择

采用“源数据分片 + 构建编译 + 详情懒加载”。

未采用浏览器直接合并全部源分片，因为这会增加请求数，让全局校验和部分失败处理进入运行时。未采用数据库或 CMS，因为当前目标不包含多人在线编辑、权限管理或服务端查询，引入持久化服务的成本明显高于收益。

生成文件不提交 Git。仓库只保存源分片、生成器、类型、校验器和测试；开发、测试、校验、字体检查与构建命令在需要时自动生成运行时数据。

## 3. 源数据组织

源数据放在 `src/data/source/`：

```text
src/data/source/
├── core.json
├── timeline-sections/
│   └── china.json
├── regions/
│   └── regions.json
├── sources/
│   └── sources.json
├── entities/
│   ├── china/
│   │   └── <entity-id>.json
│   └── world/
│       └── <entity-id>.json
├── relationships/
│   └── relationships.json
└── events/
    └── events.json
```

`core.json` 只保存 `schemaVersion` 与 `chronologyPolicy`。阶段、地区、来源、关系和事件文件分别保存对应类型的数组。

每个实体文件使用统一的 `CrownlineDataFragment` 结构：

```json
{
  "order": 10,
  "entities": [],
  "persons": [],
  "reigns": [],
  "reignVacancies": []
}
```

一个实体文件必须且只能拥有一个与文件名相同的主实体。`order` 使用唯一的正整数并以 10 为初始间隔，聚合器按它恢复实体及随附记录的稳定顺序；新增实体通常可使用相邻值之间的空位，只有空位耗尽时才统一重排。与该实体直接相关的人物、任期和空位记录优先与它放在同一文件中。人物仍是全局记录，只能定义一次；未来人物跨政权时，其他实体的任期可以通过稳定 `personId` 引用该人物，不得复制人物记录。

关系与事件可能同时连接多个实体，因此单独维护，不强行归属某个政权文件。来源继续集中定义，业务记录只保存 `sourceRefs`。

## 4. 聚合和生成边界

新增 `scripts/generate-data.ts`，职责如下：

1. 按相对路径确定性读取源文件，并按实体分片的唯一 `order` 组装实体及随附记录。
2. 合并为当前 `CrownlineData` 扁平结构。
3. 运行现有 JSON Schema 校验与跨记录语义校验。
4. 校验通过后，在临时目录生成工具用完整数据和运行时数据。
5. 完整生成成功后再分别替换 `.generated/data/` 与 `public/data/generated/`，避免留下半套产物。

生成器不得静默覆盖重复记录，也不得根据文件顺序选择重复 ID 中的某一条。所有分片合并后继续共享单一全局 ID 命名空间。

生成结果分为不会进入生产构建的工具数据，以及浏览器按需请求的运行时数据：

```text
.generated/data/
└── crownline-data.json

public/data/generated/
├── index.json
└── details/
    └── <entity-id>.json
```

`.generated/` 与 `public/data/generated/` 都加入 `.gitignore`，不作为人工维护源。工具用完整数据不得放入 `public/`，避免 Vite 将它复制到生产发布包。

## 5. 运行时数据契约

### 5.1 首屏索引

`index.json` 保存：

- `schemaVersion`
- `chronologyPolicy`
- `timelineSections`
- `entities`
- `regions`
- `detailEntityIds`

实体继续保留名称、别名、年代、分类、地区引用、说明、可信度与来源引用，因为时间轴、搜索、地区过滤和详情基础信息都会使用这些字段。索引不包含人物、任期、空位、关系、事件和完整来源记录。

`detailEntityIds` 是存在详情包的实体 ID 列表。客户端不能仅凭未经校验的字符串拼接任意 URL；只有索引声明且符合 ID 规则的实体才允许请求详情包。

### 5.2 实体详情包

每个 `<entity-id>.json` 保存：

- `schemaVersion`
- `entityId`
- `persons`
- `reigns`
- `reignVacancies`
- `relationships`
- `events`
- `sources`

详情包只包含与当前实体相关的记录：

- `reigns` 与 `reignVacancies` 的 `polityId` 等于当前实体 ID。
- `persons` 是上述任期实际引用的人物闭包。
- `relationships` 包含以当前实体为参与方的关系。
- `events` 包含当前实体参与的事件，以及当前详情关系引用的事件。
- `sources` 是实体自身及该详情包全部业务记录实际引用的来源闭包。

同一关系、事件或来源可以出现在多个详情包中。该重复是有意的静态发布优化，用少量生成产物冗余换取详情包独立加载，不改变源数据的单一定义原则。

## 6. 应用数据流

应用启动改为异步过程：

```text
启动
  → 请求 index.json
  → 校验首屏索引
  → 渲染时间轴和筛选界面
  → 用户打开实体详情
  → 查询内存缓存
  → 首次请求 details/<entity-id>.json
  → 校验 entityId 与详情结构
  → 渲染人物、任期和来源
```

`App` 只接收首屏索引。现有筛选、时间轴和年份逻辑改为依赖包含 `entities`、`regions` 与 `timelineSections` 的窄接口，不再要求完整 `CrownlineData`。

详情加载器提供按实体 ID 加载的异步接口，并在模块内缓存已成功的请求。相同实体重复打开时复用缓存结果；失败请求不永久缓存，用户关闭后重新打开可以重试。

## 7. 加载和错误状态

首屏索引加载期间显示与现有页面风格一致的加载提示。索引请求或校验失败时显示全页数据错误，因为页面没有足够数据继续工作。

打开实体后，详情弹窗立即出现并保留实体名称、年代和说明等索引内信息：

- 详情请求进行中：显示“正在加载详情”。
- 请求成功：显示统治者、任期、空位和来源。
- 请求失败：显示可读错误和“重新加载”操作；时间轴和筛选仍可使用。
- 实体没有详情包：显示“暂无已整理详情”，不得发起不存在的请求。

关闭弹窗后到达的旧请求结果不得重新打开弹窗或覆盖后来选择的其他实体。

## 8. 校验策略

全量源数据校验仍是权威门禁：生成器先组装完整 `CrownlineData`，再调用现有 `validateCrownlineData`。因此重复 ID、悬空引用、非法区间、任期越界、来源缺失、人物缺失、地区类型错误等规则保持不变。

运行时使用较窄的索引和详情校验：

- 索引验证必填字段、schema 版本、ID 格式和阶段、实体、地区之间的引用。
- 详情验证必填字段、schema 版本、请求 ID 与响应 `entityId` 一致，以及详情内部人物、任期和来源引用闭合。

运行时校验不替代构建时全量校验，而是防止部署不完整、缓存错配或静态文件损坏进入组件。

## 9. 命令与字体脚本

`package.json` 增加 `generate:data`，并通过生命周期脚本保证常用入口拥有最新生成数据：

```json
{
  "generate:data": "node --import tsx scripts/generate-data.ts",
  "predev": "npm run generate:data",
  "pretest": "npm run generate:data",
  "prebuild": "npm run generate:data",
  "precheck:fonts": "npm run generate:data",
  "preregen:fonts": "npm run generate:data"
}
```

`validate:data` 直接聚合并校验源分片，不依赖旧的生成文件。为避免 `pretest` 与组合命令重复生成，内部测试迭代可以直接调用 Vitest；对外保留 `npm test` 的自包含行为。

字体检查和字体生成脚本改为读取 `.generated/data/crownline-data.json`。`precheck:fonts` 与 `preregen:fonts` 保证直接执行任一字体命令时都会先聚合并校验源分片，使数据校验、字体检查与构建使用同一份确定产物。

最终生成目录为：

```text
.generated/data/
└── crownline-data.json

public/data/generated/
├── index.json
└── details/
    └── <entity-id>.json
```

## 10. 迁移与兼容

迁移脚本或一次性机械转换将当前 `crownline-data.json` 无损拆分为源文件。迁移完成后删除旧的人工维护文件，避免出现两个权威数据源。

迁移必须证明：

- 完整聚合对象与当前 JSON 深度相等。
- 数组顺序保持不变，避免时间轴展示顺序和快照测试发生无意义变化。
- 77 个实体、177 个人物、177 条任期、1 条明确空位和 13 个来源全部保留。
- 现有数据完整性测试的历史断言继续成立。

JSON Schema 继续描述完整 `CrownlineData`。索引与详情可以由 TypeScript 类型和针对性运行时校验保护；本次不增加新的外部校验依赖。

## 11. 测试与验收

实现遵循测试先行，覆盖：

1. 分片聚合保持完整对象、数组顺序和记录数量。
2. 重复 ID、悬空引用或无效任期使生成失败，且不会留下部分产物。
3. 索引不包含 `persons`、`reigns`、`reignVacancies`、`relationships`、`events`、`sources`。
4. 每个详情包只包含目标实体的闭包数据和实际引用来源。
5. 详情加载器成功缓存同一实体，失败后允许重试，并拒绝索引未声明的实体。
6. 详情弹窗正确展示加载、成功、无详情和失败重试状态。
7. 请求竞态不会让旧实体详情覆盖新选择。
8. 字体脚本读取生成的完整聚合数据。

完成前执行：

```bash
npm run validate:data
npm test
npm run typecheck
npm run check:fonts
npm run build
```

并检查生产输出，确认首屏索引不包含人物和任期数组，详情文件可通过相对 `base` 在 GitHub Pages 子路径下访问。

## 12. 非目标

本次不实现以下内容：

- 数据库、CMS 或在线编辑后台。
- 按年份或地区进行服务端查询。
- 离线缓存、Service Worker 或持久化浏览器缓存。
- 预加载相邻政权详情。
- 修改历史数据口径或补充新历史记录。
- 页面视觉重设计。
