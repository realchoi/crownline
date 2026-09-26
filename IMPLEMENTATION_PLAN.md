# 探索控制台重排

依据 2026-09-26 设计评审：呈现方式、时间、地区/搜索、类别分层；年份控件合并；图例即类别筛选。URL 契约不变，类别筛选保持单选。

## Stage 1: 合并年份控件

**Goal**: 时间范围控件只保留“全时期”按钮、可编辑年份框（纪元 + 数字）、± 步进与滑杆；删除“指定年份”切换、只读当前年份和独立的精确跳转表单。
**Success Criteria**: 输入年份回车、失焦（已修改时）或点击跳转进入指定年份；改纪元立即生效；全时期时年份框留空、步进禁用、滑杆拇指淡出但仍可拖动进入年份；非法输入给出原有错误提示。
**Tests**: `tests/year-input.test.tsx` 重写为新控件行为；`app-browse`/`app-map`/`app-time-window` 改用年份框与“全时期”按钮；`e2e/year-input.spec.ts` 同步。
**Status**: Complete

## Stage 2: 图例即类别筛选

**Goal**: 用一组 `aria-pressed` 类别按钮（全部 + 四类，时间轴视图带色标）替换“显示类别”下拉框、独立图例与控制台里的清除按钮。
**Success Criteria**: 单选语义不变，再次点击已选类别回到全部；地图视图不显示色标；`type` URL 参数不变。
**Tests**: `app-browse` 类别相关用例、控制台用例。
**Status**: Complete

## Stage 3: 控制台层级重排

**Goal**: 第一行呈现方式页签 + 观测范围下拉浮层 + 搜索；第二行全宽时间刻度尺；第三行类别；地图图层开关移到地图结果区；取消“更多筛选”。
**Success Criteria**: 浮层支持 Escape、点外关闭与焦点恢复；疆域加载失败时仍可切回地点标记；桌面 1120px 下无横向溢出。
**Tests**: 控制台、地区、地图图层集成测试；E2E 冒烟与 axe。
**Status**: Complete

## Stage 4: 紧凑条与移动端

**Goal**: 滚动后的紧凑工具条与移动端首屏可直接改年份；移动抽屉不再重复呈现方式。
**Success Criteria**: 紧凑条保留状态与“展开控制台”；移动端 44px 触控目标、抽屉无横向溢出。
**Tests**: 控制台集成测试、`e2e/year-input.spec.ts`、响应式 E2E。
**Status**: In Progress

## Stage 5: 收尾

**Goal**: 字体子集、文档、完整检查。
**Success Criteria**: `npm run check` 通过；README 中控制台描述与实际一致。
**Tests**: `npm run check`。
**Status**: Not Started
