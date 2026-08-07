# Crownline Data Sharding and Lazy Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic production JSON with maintainable entity shards, generate validated browser artifacts, and load entity details only when opened.

**Architecture:** A Node build module reads deterministic source shards into the existing complete `CrownlineData`, validates the complete graph, then derives a small `CrownlineIndex` plus one `CrownlineDetail` per entity. React loads the index at startup and injects an asynchronous cached detail loader into `App`; build-time full validation remains authoritative while narrow runtime validators protect fetched artifacts.

**Tech Stack:** TypeScript 7, Node.js 26, Vite 8, React 19, Vitest 4, Testing Library, Ajv 8, Python fonttools scripts.

## Global Constraints

- Generated artifacts are written to `.generated/data/` and `public/data/generated/` and are not committed.
- GitHub Pages deployment must continue to work with Vite `base: "./"`.
- Do not add a database, CMS, server API, router, state library, or validation dependency.
- Preserve the existing full-data JSON Schema and semantic validation rules.
- Preserve current array order and historical data semantics during migration.
- Do not commit, push, or alter Git history without separate user confirmation.
- New behavior follows test-first red-green-refactor cycles.

---

### Task 1: Define Runtime Data Contracts and Artifact Derivation

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/data/artifacts.ts`
- Create: `tests/data-artifacts.test.ts`

**Interfaces:**
- Consumes: existing `CrownlineData` and its record types.
- Produces: `CrownlineIndex`, `CrownlineDetail`, `GeneratedArtifacts`, and `buildGeneratedArtifacts(data: CrownlineData): GeneratedArtifacts`.

- [ ] **Step 1: Write failing artifact tests**

Create tests that call the wished-for API with current production data and assert:

```ts
const artifacts = buildGeneratedArtifacts(data);

expect(artifacts.index).not.toHaveProperty("persons");
expect(artifacts.index).not.toHaveProperty("reigns");
expect(artifacts.index.detailEntityIds).toEqual(data.entities.map(({ id }) => id));

const tang = artifacts.details.get("polity-cn-tang");
expect(tang?.reigns.every(({ polityId }) => polityId === "polity-cn-tang")).toBe(true);
expect(new Set(tang?.persons.map(({ id }) => id))).toEqual(
  new Set(tang?.reigns.map(({ personId }) => personId))
);
expect(tang?.sources.map(({ id }) => id)).toEqual(expect.arrayContaining([
  "source-cn-chronology-table"
]));
```

Also assert that a relationship shared by two entities and its referenced event/source appear in both applicable details using a minimal complete fixture.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/data-artifacts.test.ts`

Expected: FAIL because `src/data/artifacts.ts` and runtime artifact types do not exist.

- [ ] **Step 3: Add narrow runtime types**

Add to `src/domain/types.ts`:

```ts
export interface CrownlineIndex {
  schemaVersion: 3;
  chronologyPolicy: ChronologyPolicy;
  timelineSections: TimelineSection[];
  entities: HistoricalEntity[];
  regions: Region[];
  detailEntityIds: string[];
}

export interface CrownlineDetail {
  schemaVersion: 3;
  entityId: string;
  persons: Person[];
  reigns: Reign[];
  reignVacancies: ReignVacancy[];
  relationships: Relationship[];
  events: HistoricalEvent[];
  sources: Source[];
}

export type BrowseData = Pick<CrownlineIndex, "timelineSections" | "entities" | "regions">;
```

- [ ] **Step 4: Implement deterministic artifact derivation**

In `src/data/artifacts.ts`, preserve full-data order while computing reference closures. Collect every source reference from the entity, alternative chronologies, persons, reigns, vacancies, relationships, and events selected for the detail. Return details in a `Map<string, CrownlineDetail>` keyed by entity ID.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/data-artifacts.test.ts`

Expected: all artifact derivation tests pass.

---

### Task 2: Aggregate Source Shards and Generate Atomically

**Files:**
- Create: `scripts/data-source.ts`
- Create: `scripts/generate-data.ts`
- Create: `tests/data-source.test.ts`
- Modify: `scripts/validate-data.ts`

**Interfaces:**
- Consumes: `src/data/source/**.json`, `validateCrownlineData`, and `buildGeneratedArtifacts`.
- Produces: `loadSourceData(sourceRoot?: string): Promise<CrownlineData>` and `generateData(options?: GenerateDataOptions): Promise<GeneratedDataSummary>`.

- [ ] **Step 1: Write failing source aggregation tests**

Use a temporary fixture tree with `core.json`, array files, and two entity fragments. Assert that `loadSourceData(tempRoot)`:

```ts
expect(data.entities.map(({ id }) => id)).toEqual(["polity-a", "polity-b"]);
expect(data.persons.map(({ id }) => id)).toEqual(["person-a"]);
expect(data.relationships).toEqual([]);
```

The entity fragment files must first be discovered in sorted relative POSIX path order so results do not depend on filesystem enumeration order, then their records must be assembled by unique positive integer `order`. Add rejection cases for duplicate `order` values and a fragment whose filename does not match its single entity ID.

- [ ] **Step 2: Run aggregation tests and verify RED**

Run: `npx vitest run tests/data-source.test.ts`

Expected: FAIL because the source aggregation module does not exist.

- [ ] **Step 3: Implement shard parsing and aggregation**

Implement explicit JSON reading with `node:fs/promises`. Validate the local shape needed to produce clear file-level errors before assembling arrays. Do not duplicate full schema logic; complete graph validation remains in `validateCrownlineData`.

- [ ] **Step 4: Add failing atomic generation tests**

Against temporary output roots, assert:

```ts
await generateData({ sourceRoot, toolOutputRoot, publicOutputRoot });
expect(await readJson(`${publicOutputRoot}/index.json`)).toMatchObject({ schemaVersion: 3 });
expect(await readJson(`${publicOutputRoot}/details/polity-a.json`)).toMatchObject({
  entityId: "polity-a"
});
```

For an invalid source graph, pre-create a sentinel file in the public output and assert generation rejects while the sentinel remains untouched.

- [ ] **Step 5: Run generation tests and verify RED**

Run: `npx vitest run tests/data-source.test.ts`

Expected: the aggregation cases pass and generation cases fail because `generateData` is missing.

- [ ] **Step 6: Implement validated atomic generation**

Generate formatted JSON with a trailing newline into sibling temporary directories. Only after all files have been written should the implementation replace the two explicit output directories. Never delete or replace a path outside the supplied/default `.generated/data` and `public/data/generated` roots.

The CLI prints counts for sections, entities, persons, reigns, details, and sources. `scripts/validate-data.ts` calls `loadSourceData`, runs `validateCrownlineData`, and prints the same authoritative record counts without depending on generated files.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `npx vitest run tests/data-source.test.ts`

Expected: aggregation, validation failure, artifact writing, and no-partial-replacement tests pass.

---

### Task 3: Migrate the Monolith to Entity-Owned Source Shards

**Files:**
- Create: `src/data/source/core.json`
- Create: `src/data/source/timeline-sections/china.json`
- Create: `src/data/source/regions/regions.json`
- Create: `src/data/source/sources/sources.json`
- Create: `src/data/source/entities/china/<entity-id>.json` for the 73 timeline entities
- Create: `src/data/source/entities/world/<entity-id>.json` for the 4 external entities
- Create: `src/data/source/relationships/relationships.json`
- Create: `src/data/source/events/events.json`
- Delete after equivalence proof: `src/data/crownline-data.json`
- Modify: `tests/data-integrity.test.ts`
- Modify: all tests importing the old monolith

**Interfaces:**
- Consumes: current `src/data/crownline-data.json` as the one-time migration source.
- Produces: source shards whose aggregate is deeply equal to the current complete object.

- [ ] **Step 1: Add a temporary migration-equivalence test before deleting the monolith**

Import the current JSON as `legacyData`, call `loadSourceData()`, and assert:

```ts
expect(await loadSourceData()).toEqual(legacyData);
```

- [ ] **Step 2: Run the equivalence test and verify RED**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: FAIL because `src/data/source/` is not populated.

- [ ] **Step 3: Mechanically split current data**

Use a one-time read-only transformation of the existing object to prepare an `apply_patch` that creates the source files:

- place each entity in a fragment named `<entity.id>.json` with `order: (arrayIndex + 1) * 10`;
- attach reigns and vacancies matching that entity ID;
- attach each person to the fragment of their first reign's polity; current data has no person serving multiple polities;
- preserve entity, person, reign, vacancy, section, region, source, relationship, and event order;
- use `china/` for the 73 section-owned entities and `world/` for the 4 entities absent from sections.

- [ ] **Step 4: Run equivalence test and verify GREEN**

Run: `npx vitest run tests/data-integrity.test.ts`

Expected: the aggregate is deeply equal to the monolith.

- [ ] **Step 5: Remove the legacy authority and update data fixtures**

Delete `src/data/crownline-data.json`. Replace direct JSON imports in tests with an async shared production-data helper based on `loadSourceData()`. Keep historical assertions for 77 entities, 177 persons, 177 reigns, one vacancy, and 13 sources.

- [ ] **Step 6: Run data-focused regression tests**

Run: `npx vitest run tests/data-integrity.test.ts tests/selectors.test.ts tests/overview-timeline.test.ts tests/browse-state.test.ts`

Expected: all data and browsing tests pass without importing the deleted file.

---

### Task 4: Validate and Cache Runtime Fetches

**Files:**
- Create: `src/data/runtimeValidation.ts`
- Replace: `src/data/loadCrownlineData.ts` with `src/data/loadCrownlineIndex.ts`
- Create: `src/data/loadCrownlineDetail.ts`
- Create: `tests/data-loaders.test.ts`

**Interfaces:**
- Produces: `validateCrownlineIndex(input: unknown): ValidationResult`, `validateCrownlineDetail(input: unknown, expectedEntityId: string): ValidationResult`, `loadCrownlineIndex(fetcher?: typeof fetch): Promise<CrownlineIndex>`, and `createCrownlineDetailLoader(index: CrownlineIndex, fetcher?: typeof fetch): CrownlineDetailLoader`.
- `CrownlineDetailLoader` signature: `(entityId: string) => Promise<CrownlineDetail | null>`; `null` means the index declares no detail package.

- [ ] **Step 1: Write failing runtime validation tests**

Assert a generated real index/detail validates, and reject:

- an index section referencing a missing entity;
- a detail whose `entityId` differs from the requested ID;
- a reign referencing a person absent from its detail;
- a source reference absent from its detail.

- [ ] **Step 2: Verify validation tests fail**

Run: `npx vitest run tests/data-loaders.test.ts`

Expected: FAIL because runtime validators do not exist.

- [ ] **Step 3: Implement narrow runtime validators**

Use explicit type guards and reference checks without importing Ajv or the full JSON Schema into the browser path. Return the existing `ValidationResult` shape with stable issue codes and paths.

- [ ] **Step 4: Add failing loader behavior tests**

Use a small fetcher fake that records URLs and returns real `Response` objects. Assert:

```ts
const loadDetail = createCrownlineDetailLoader(index, fetcher);
await Promise.all([loadDetail("polity-a"), loadDetail("polity-a")]);
expect(requestedUrls).toHaveLength(1);
```

Also assert successful results remain cached, failed requests are removed from cache and retry on the next call, undeclared entity IDs return `null` without fetching, non-OK responses reject, and URLs begin with `import.meta.env.BASE_URL`-compatible generated paths.

- [ ] **Step 5: Verify loader tests fail**

Run: `npx vitest run tests/data-loaders.test.ts`

Expected: validators pass and loader tests fail because loaders do not exist.

- [ ] **Step 6: Implement index and detail loaders**

Construct request paths as `${import.meta.env.BASE_URL}data/generated/index.json` and `${import.meta.env.BASE_URL}data/generated/details/${encodeURIComponent(entityId)}.json`. Vite resolves `BASE_URL` to `./` for the configured static deployment, so requests remain under the GitHub Pages project directory. Cache in-flight and successful promises; delete the cache entry in rejection handling.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `npx vitest run tests/data-loaders.test.ts`

Expected: all validation, URL, caching, retry, and rejection tests pass.

---

### Task 5: Render Async Startup and Detail States

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/components/DetailDialog.tsx`
- Modify: `src/domain/rulerSnapshot.ts`
- Modify: `src/domain/selectors.ts`
- Modify: `src/domain/browseState.ts`
- Modify: `src/domain/overviewTimeline.ts`
- Modify: `src/components/Timeline.tsx` if its prop unnecessarily requires full data
- Modify: `src/styles/styles.css` only for loading/error/retry states
- Modify: `tests/app.test.tsx`

**Interfaces:**
- `App` consumes `data: CrownlineIndex` and `loadDetail: CrownlineDetailLoader`.
- `DetailDialog` consumes base index data plus `detailState: { status: "missing" | "loading" | "ready" | "error"; detail?: CrownlineDetail; message?: string }` and `onRetry`.
- `selectRulerSnapshot` consumes only entity plus detail records required for ruler lookup, not full `CrownlineData`.

- [ ] **Step 1: Add failing App tests for lazy detail loading**

Render `App` with a real generated index and a deferred `loadDetail`. Assert:

- opening an entity immediately shows its base title and “正在加载详情”;
- resolving the promise shows the selected-year ruler;
- overview mode preserves the existing ruler guidance;
- rejection shows an alert and “重新加载” button;
- retry invokes the loader again;
- a `null` result shows “暂无已整理详情”;
- resolving an old entity after selecting another does not render the old detail.

- [ ] **Step 2: Run App test and verify RED**

Run: `npx vitest run tests/app.test.tsx`

Expected: FAIL because `App` does not accept a detail loader or render async states.

- [ ] **Step 3: Narrow browse-domain inputs**

Replace full `CrownlineData` parameters with `BrowseData` or narrower `Pick<>` types where only index fields are read. Change `selectRulerSnapshot` to receive the selected `HistoricalEntity` and `CrownlineDetail` so it cannot accidentally depend on unloaded global data.

- [ ] **Step 4: Implement request lifecycle in App**

Keep an incrementing request sequence in a ref. Capture the sequence and entity ID when starting a load, and commit a result only while both still match the active selection. Start loading only if `detailEntityIds` includes the ID. Keep the dialog open with base entity metadata during loading. Closing or selecting another entity increments the sequence so old completion handlers are ignored.

- [ ] **Step 5: Render detail states and retry**

Keep static entity metadata, region names, chronology notes, and duration visible regardless of detail state. Gate ruler and source sections on ready detail data. The retry callback starts a fresh request without closing the dialog.

- [ ] **Step 6: Make startup asynchronous**

In `main.tsx`, render a page-level loading status, await `loadCrownlineIndex()`, construct the detail loader, then render `App`. On failure, retain the current page-level data error behavior and log the detailed error.

- [ ] **Step 7: Run App and domain tests and verify GREEN**

Run: `npx vitest run tests/app.test.tsx tests/selectors.test.ts tests/overview-timeline.test.ts tests/browse-state.test.ts`

Expected: async states pass and existing browsing interactions remain green.

---

### Task 6: Integrate Commands, Fonts, Ignore Rules, and Documentation

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `scripts/check-font-subset.py`
- Modify: `scripts/regen-font-subsets.py`
- Modify: `README.md`
- Modify: `docs/data-contract.md`
- Modify: relevant tests/scripts that still mention `crownline-data.json`

**Interfaces:**
- `npm run generate:data` generates both ignored output trees.
- `npm run validate:data` validates source shards directly.
- `npm run dev`, `npm test`, `npm run build`, `npm run check:fonts`, and `npm run regen:fonts` generate first through lifecycle scripts.

- [ ] **Step 1: Add command lifecycle entries and ignore generated roots**

Add exactly:

```json
"generate:data": "node --import tsx scripts/generate-data.ts",
"predev": "npm run generate:data",
"pretest": "npm run generate:data",
"prebuild": "npm run generate:data",
"precheck:fonts": "npm run generate:data",
"preregen:fonts": "npm run generate:data"
```

Ignore `/.generated/` and `/public/data/generated/` with root-anchored patterns.

- [ ] **Step 2: Update font inputs**

Change both Python scripts to read `.generated/data/crownline-data.json`. Keep the character collection rules unchanged.

- [ ] **Step 3: Update maintenance documentation**

Document entity shard ownership, cross-file stable IDs, generated-artifact status, required commands, and the runtime split. Remove instructions that tell maintainers to edit the monolith.

- [ ] **Step 4: Check for stale monolith references**

Run:

```bash
rg -n "src/data/crownline-data\.json|crownline-data\.json" src tests scripts README.md docs/data-contract.md package.json
```

Expected: only deliberate references to `.generated/data/crownline-data.json` remain.

---

### Task 7: Completion Verification and Artifact Inspection

**Files:**
- Verify all files changed by Tasks 1–6.

- [ ] **Step 1: Generate and validate data**

Run: `npm run validate:data && npm run generate:data`

Expected: exit 0 with 7 sections, 77 entities, 177 persons, 177 reigns, 77 detail artifacts, and 13 sources.

- [ ] **Step 2: Verify generated artifact boundaries**

Run JSON assertions that prove:

- `public/data/generated/index.json` lacks full-detail array keys;
- `.generated/data/crownline-data.json` retains all complete-data keys and counts;
- `public/data/generated/details/polity-cn-tang.json` contains only Tang reigns and their referenced people/sources;
- no `crownline-data.json` exists under `public/` or `dist/`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: all Vitest files and tests pass with zero failures.

- [ ] **Step 4: Run static checks and font coverage**

Run: `npm run typecheck && npm run check:fonts`

Expected: TypeScript exits 0 and font coverage reports no missing characters.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: exit 0; Vite emits the app plus `data/generated/index.json` and detail files, but no complete `crownline-data.json`.

- [ ] **Step 6: Inspect diff and working tree**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only task-related source, tests, scripts, data shards, and documentation are changed. Generated roots remain untracked and hidden by `.gitignore`.
