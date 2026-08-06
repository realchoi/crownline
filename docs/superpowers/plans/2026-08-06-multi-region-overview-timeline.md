# Multi-Region Overview Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend overview mode so China, custom region selections, and all indexed regions can browse complete readable timelines with shared URL state and no duplicated cross-region entities.

**Architecture:** Keep the existing Chinese seven-section timeline unchanged for the default China scope. Add a pure overview grouping module that creates region-local timeline groups for custom/global scopes, placing entities that match multiple visible top-level regions in one cross-region group. React remains responsible only for controlled browse state, rendering the groups, and accessible empty/coverage states.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Testing Library, CSS.

## Global Constraints

- Do not add dependencies or change the v2 JSON data contract.
- Preserve the current 73-entity, seven-section Chinese overview presentation.
- A cross-region entity appears in exactly one overview group for the active scope.
- Every timeline group uses its own data-derived year range so short-lived entities remain readable.
- “全球已收录” means only the current dataset and never implies complete world-history coverage.
- Region state is shared by overview and timepoint modes and restored from the existing `scope` and `region` URL parameters.
- Do not create Git commits without explicit user authorization.

---

### Task 1: Share region URL state across browse modes

**Files:**
- Modify: `tests/browse-state.test.ts`
- Modify: `src/domain/browseState.ts`

**Interfaces:**
- Consumes: existing `RegionScope`, `Region[]`, `BrowseState`.
- Produces: unchanged `readBrowseState(search, bounds, regions): BrowseState` and `writeBrowseState(state, bounds, currentSearch?): URLSearchParams`, now mode-independent for region parameters.

- [ ] **Step 1: Write failing state tests**

Add assertions that `readBrowseState("?scope=global", bounds, data.regions)` returns global overview state; custom overview URLs retain sorted valid region IDs; `writeBrowseState` emits scope parameters in overview mode; and changing only `mode` does not change `regionScope`.

- [ ] **Step 2: Run the focused test and confirm the old mode gate fails**

Run: `npm test -- tests/browse-state.test.ts`

Expected: the new overview scope assertions fail because current code forces China and omits overview scope parameters.

- [ ] **Step 3: Remove mode-dependent scope parsing and serialization**

In `readBrowseState`, derive `regionScope` from valid `scope`/`region` parameters regardless of `mode`. In `writeBrowseState`, serialize global/custom scopes regardless of `state.mode`; keep China implicit.

- [ ] **Step 4: Re-run focused tests**

Run: `npm test -- tests/browse-state.test.ts`

Expected: all browse-state tests pass.

### Task 2: Build deterministic overview timeline groups

**Files:**
- Create: `src/domain/overviewTimeline.ts`
- Create: `tests/overview-timeline.test.ts`

**Interfaces:**
- Consumes: `CrownlineData`, `MatchedEntity[]`, `RegionScope`.
- Produces:

```ts
export interface OverviewTimelineGroup {
  id: string;
  title: string;
  displayRange: string;
  range: { startYear: number; endYear: number };
  matches: MatchedEntity[];
  regionId?: string;
  kind: "china-section" | "region" | "cross-region";
}

export function buildOverviewTimelineGroups(
  data: CrownlineData,
  matches: MatchedEntity[],
  scope: RegionScope
): OverviewTimelineGroup[];
```

- [ ] **Step 1: Write failing group tests**

Cover these exact behaviors:

- China scope returns seven groups matching `timelineSections` order and ranges.
- Global scope includes a cross-region group containing Byzantine and Abbasid exactly once each.
- Europe-only scope places Byzantine and Holy Roman Empire in the Europe group, because only one active top-level region matches.
- Europe plus West Asia moves Byzantine into the cross-region group and leaves Holy Roman Empire in Europe.
- Group entities sort by earliest start ordinal, latest end ordinal, then `names.primary`.
- Group range is the min/max of included existence periods and a single-year fixture expands to a safe two-ordinal drawing span.
- Empty filtered groups are omitted.

- [ ] **Step 2: Run the focused test and confirm the module is absent**

Run: `npm test -- tests/overview-timeline.test.ts`

Expected: fail because `overviewTimeline.ts` does not exist.

- [ ] **Step 3: Implement pure grouping**

Use `expandHistoricalRegionIds` to resolve selected descendants and a parent-walk helper local to the module to map entity region IDs to active top-level historical regions. For global scope, all top-level historical regions with indexed entities are active. For custom scope, only selected top-level regions and their descendants participate. Put matches with more than one active top-level region into `overview-cross-region`; otherwise use `overview-region-${regionId}`. Build ranges from all included periods using historical ordinals so the missing year zero does not distort arithmetic.

- [ ] **Step 4: Re-run group tests**

Run: `npm test -- tests/overview-timeline.test.ts`

Expected: all overview grouping tests pass.

### Task 3: Render shared scope controls and dynamic groups

**Files:**
- Modify: `tests/app.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/components/FilterPanel.tsx`
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/TimelineStage.tsx`

**Interfaces:**
- `Timeline` consumes `scope: RegionScope`, `regions: Region[]`, and the already filtered `matches`.
- `TimelineStage` consumes `group: OverviewTimelineGroup` and `regions: Region[]` instead of a China-only `TimelineSection`.
- `App` uses `buildOverviewTimelineGroups` only indirectly through `Timeline`; selection remains `onSelect(entityId, trigger)`.

- [ ] **Step 1: Write failing app behavior tests**

Add tests for:

- The region control is visible in overview mode.
- `/?scope=global` restores global overview and renders all 77 entities, including the four external entities.
- Byzantine and Abbasid have one timeline row each in global overview even though each belongs to two regions.
- Custom Europe + West Asia persists while switching overview → point → overview.
- `/?scope=custom&region=region-americas` shows the unindexed-data message and does not say “当时不存在”.
- Default China overview still reports 73 / 73 entities and seven historical stages.

- [ ] **Step 2: Run the focused app tests and confirm current behavior fails**

Run: `npm test -- tests/app.test.tsx`

Expected: new tests fail because overview hides/resets scope controls and dynamic groups are not rendered.

- [ ] **Step 3: Keep scope state when the mode changes**

In `App`, always pass `browseState.regionScope` to `selectBrowseResults`; update `onModeChange` to change only `mode`. Show the external-data scope note whenever the scope is custom/global, regardless of browse mode. Calculate overview totals from the unfiltered results for the active scope.

- [ ] **Step 4: Show RegionScopeControl in both modes**

Render `RegionScopeControl` outside the point-only condition in `FilterPanel`; keep the year panel point-only and the category legend overview-only. Update the component comment from “时间点模式” to shared browsing scope.

- [ ] **Step 5: Render overview groups through the generalized stage component**

In `Timeline`, call `buildOverviewTimelineGroups(data, matches, scope)`, render one `TimelineStage` per group, and use a scope-aware accessible label. For empty matches, inspect whether the active scope has any unfiltered polity and show either the unindexed message or the filtered-out message.

In `TimelineStage`, read `title`, `displayRange`, and `range` from the generic group. Add one `.row-regions` line only for `kind === "cross-region"`, resolving the entity’s currently relevant top-level region names. Keep one `.timeline-row` per entity and one button per existence interval.

- [ ] **Step 6: Re-run focused app tests**

Run: `npm test -- tests/app.test.tsx`

Expected: all app tests pass, including unchanged dialog/focus/timepoint behaviors.

### Task 4: Preserve readability and responsive layout

**Files:**
- Modify: `src/styles/styles.css`

**Interfaces:**
- Consumes new classes `.controls-overview .region-scope-control`, `.timeline-group-cross-region`, and `.row-regions`.
- Produces responsive layout only; no domain behavior.

- [ ] **Step 1: Add overview control layout styles**

Place the shared region scope between the mode row and filter grid. Keep overview controls compact on desktop and stack the region heading below 760px.

- [ ] **Step 2: Add cross-region group and metadata styling**

Use the existing period accent for a subtle cross-region heading marker and render `.row-regions` as a single-line muted label. Do not add a new category color or change bar semantics.

- [ ] **Step 3: Verify responsive selectors**

Run: `npm run build`

Expected: TypeScript and Vite build succeed with no invalid imports or style processing errors.

### Task 5: Synchronize product documentation

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`

**Interfaces:** None.

- [ ] **Step 1: Update README current capabilities**

State that all three region scopes work in overview and timepoint modes, that overview uses China historical stages or region-local groups, and that cross-region entities are deduplicated. Keep the sample-data limitation prominent.

- [ ] **Step 2: Mark stage 2B complete in ROADMAP**

Check all six stage 2B items and add a 2026-08-06 completion record describing shared URL scope, region-local scales, cross-region grouping, readable short durations, empty/coverage messaging, and regression coverage.

### Task 6: Run completion gates

**Files:**
- Verify all modified files.

**Interfaces:** None.

- [ ] **Step 1: Validate data**

Run: `npm run validate:data`

Expected: the v2 dataset is valid.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 3: Run static and production checks**

Run: `npm run typecheck && npm run build`

Expected: both commands exit 0 and Vite emits `dist/`.

- [ ] **Step 4: Inspect the final diff and working tree**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only task-related files are modified or created.

- [ ] **Step 5: Perform visual QA**

Run the Vite development server and inspect default China, global, Europe + West Asia, and Americas-empty overview states at desktop and narrow widths. Check light/dark color schemes, focus rings, row labels, minimum-width bars, and absence of horizontal overflow.
