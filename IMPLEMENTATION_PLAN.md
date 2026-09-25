# 网页设计优化实施计划

来源：2026-09-25 基于桌面/移动/深色截图与源码的设计审查。

## Stage 1: 时间轴坐标系

**Goal**: 时间轴在长列表滚动中始终可读：吸顶坐标轴、整数年代刻度与网格线、极短政权可见可点，并修正整段时间轴的 live region。
**Success Criteria**:

- 坐标刻度落在整数年代（如每 500 年），跨公元前后时不出现公元 0 年，刻度数量受上限约束。
- 共享坐标轴与中国模式各阶段坐标轴滚动时吸顶，且位于紧凑工具条/移动探索栏下方。
- 每条轨道显示与刻度对齐的网格线；时间条最小可视宽度 4px。
- `#timeline` 不再是 `aria-live` 区域，结果变化只由摘要 `role="status"` 播报。

**Tests**: `tests/timeline-axis.test.ts` 刻度边界；`tests/app/app-browse.test.tsx` 坐标轴名称与 live region；e2e 桌面/移动吸顶与无横向溢出。
**Status**: Complete

## Stage 2: 时间窗口缩放

**Goal**: 支持在时间轴上选择/缩放时间窗口并写入 URL。
**Success Criteria**:

- 坐标轴刻度之间的分段是可键盘操作的放大按钮，最短 10 年；放大后只保留与窗口重叠的条目，窗口外的存续区间不绘制，被截断一端显示平头。
- “缩小”以中心扩大约 3 倍并对齐整数年代；“恢复全时期”与活跃筛选中的“时间窗口”标签可还原。
- `from`/`to` 读取时清洗（公元 0 年、颠倒、不足 10 年、覆盖全范围均视为未设置），只在全时期时间轴写入，保留未知参数，使用 `replaceState`；刷新与前进后退恢复。
- 窗口内无已收录政权时不写成历史上不存在。

**Tests**: `tests/time-window.test.ts`、`tests/browse-state.test.ts`、`tests/selectors.test.ts`、`tests/app/use-browse-url-state.test.tsx`、`tests/app/app-time-window.test.tsx`；e2e 放大、刷新恢复、axe 与无横向溢出。
**Status**: Complete

## Stage 3: 移动端行密度

**Goal**: 紧凑行、对比入口图标化、长分组预览，显著降低移动端页面高度。
**Success Criteria**:

- ≤640px 时名称与年代同行、对比为 44×44 图标按钮，普通行高由约 100px 降到 74px。
- 9 行及以上的分组先预览 6 行，已选入对比的行始终保留；开关带 `aria-expanded`/`aria-controls`，收起后开关回到视口；桌面完整显示。
- 390px 首页高度由 15,383px 降到约 5,700px（中国范围 8,633px → 约 4,600px）。

**Tests**: `tests/app/app-browse.test.tsx` 开关语义与阈值；e2e 手机紧凑行、预览展开收起与焦点、桌面完整显示。
**Status**: Complete

## Stage 4: 年份切片卡片与对比弹窗

**Goal**: 卡片去重与排序、空分区折叠、对比入口入卡；对比弹窗增加共同存续双轨图。
**Success Criteria**: 卡片不重复地区信息；主线优先；对比弹窗以图示呈现重叠区间。
**Tests**: 组件测试、e2e。
**Status**: Not Started

## Stage 5: CSS token 与断点整理

**Goal**: 收敛断点、建立字号/阴影 token、合并散落的深色覆盖，不改变视觉。
**Success Criteria**: 断点数量收敛；硬编码颜色进入 token；截图对比无意外变化。
**Tests**: 现有全部测试与 e2e。
**Status**: Not Started
