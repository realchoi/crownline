# 第 5 步：测试与文档整理、结构化关系补充

## Stage 1: 批次测试改写为规则不变量

**Goal**: 把 `source-evidence-p0*`、`temporal-geography-*-review`、`geography-evidence-p2`、`geography-locator-evidence-review` 等按批次命名、硬编码记录 ID 的测试，改写为按规则的不变量测试；确有价值的具体历史口径断言集中保留。
**Success Criteria**:

- 批次测试文件删除，新增 `tests/source-evidence-rules.test.ts`（来源定位规则）、`tests/geography-evidence-rules.test.ts`（点位证据与审查档案一致性）和 `tests/geography-chronology.test.ts`（关键都城/政治中心分期口径）。
- 原测试保护的每条规则都有对应不变量或被 `check:evidence` 预算门禁覆盖；预算数字不再在测试中重复硬编码。
- `npm run check` 通过。
  **Tests**: GeoNames 首页引用不得带 locator；dataset 坐标来源（通用首页除外）必须定位；全部定位的点位必须有历史依据来源；政权纪年表不能单独支撑点位；locator 中的检索日期不晚于来源访问日期；点位说明披露限制；审查档案摘要与条目、生产数据一致，完全无定位点位必须登记待补证据；具名王表来源的引用指明具体人物。
  **Status**: Complete

## Stage 2: 批次审查文档归档

**Goal**: 把 p0/p1/p2 批次审查记录移入 `docs/archive/`，同步修正 README、ROADMAP、数据契约和文档间链接。
**Success Criteria**: 仓库内无指向旧路径的链接；`check:docs`、`check:evidence`、`check:coverage-plan` 不受影响（`global-coverage-plan.md` 与数据契约保持原位）；`npm run check` 通过。
**Tests**: 链接扫描脚本确认所有相对 Markdown 链接目标存在。
**Status**: In Progress

## Stage 3: 关系覆盖分析与候选清单

**Goal**: 统计无关系政权、同时存续且地区相邻但缺少已录关系的组合，列出候选关系及拟用来源（含 locator 草案），交用户审核。
**Success Criteria**: 候选清单只包含来源直接支持参与方、类型与时间口径的关系；不写入数据。
**Tests**: 无（分析产物）。
**Status**: Not Started

## Stage 4: 写入经审核的关系

**Goal**: 按用户确认的候选写入 `src/data/source/relationships/`，同步来源、数据摘要区块与文档。
**Success Criteria**: `validate:data`、`check:docs`、`check:evidence` 与 `npm run check` 全部通过；每条关系都有精确 locator。
**Tests**: 关系不变量（参与方存续期相交、来源定位完整、朝贡不标臣属等）。
**Status**: Not Started
