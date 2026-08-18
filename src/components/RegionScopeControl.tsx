import { CHINA_REGION_ID, type RegionScope } from "../domain/regionScope";
import type { Region } from "../domain/types";

interface RegionScopeControlProps {
  regions: Region[];
  scope: RegionScope;
  onChange: (scope: RegionScope) => void;
}

/** 全览与时间点模式共享的地区预设、多选地区和数据覆盖说明。 */
export function RegionScopeControl({ regions, scope, onChange }: RegionScopeControlProps) {
  const selectableRegions = regions.filter((region) => {
    return region.regionKind === "historical-region" && region.id !== CHINA_REGION_ID;
  });
  const selectedIds = scope.mode === "custom" ? scope.regionIds : [];
  const selectedRegions = selectableRegions.filter(({ id }) => selectedIds.includes(id));
  const coverageText =
    scope.mode === "global"
      ? "当前数据集中的全部已收录条目；不代表世界历史已完整覆盖。"
      : scope.mode === "china"
        ? (regions.find(({ id }) => id === CHINA_REGION_ID)?.coverage.note ??
          "采用中国历史浏览范围。")
        : selectedRegions.map(({ coverage }) => coverage.note).join(" ");

  const chooseMode = (mode: RegionScope["mode"]) => {
    if (mode === "china") onChange({ mode: "china" });
    if (mode === "global") onChange({ mode: "global" });
    if (mode === "custom") {
      const defaultRegionId = selectableRegions[0]?.id;
      onChange({
        mode: "custom",
        regionIds: selectedIds.length > 0 ? selectedIds : defaultRegionId ? [defaultRegionId] : []
      });
    }
  };

  return (
    <section className="region-scope-control" aria-label="地区范围">
      <div className="region-scope-heading">
        <div>
          <span className="field-label">观测范围</span>
          <div className="scope-switch" role="group" aria-label="地区范围预设">
            {(
              [
                ["china", "中国"],
                ["custom", "自选地区"],
                ["global", "全球已收录"]
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={scope.mode === mode}
                disabled={mode === "custom" && selectableRegions.length === 0}
                onClick={() => chooseMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="region-coverage-note">{coverageText}</p>
      </div>

      {scope.mode === "custom" && (
        <fieldset className="region-options">
          <legend>选择一个或多个历史地区</legend>
          <div className="region-option-list">
            {selectableRegions.map((region) => {
              const checked = selectedIds.includes(region.id);
              return (
                <label key={region.id}>
                  <input
                    type="checkbox"
                    aria-label={region.names.primary}
                    checked={checked}
                    disabled={checked && selectedIds.length === 1}
                    onChange={(event) => {
                      const nextIds = event.currentTarget.checked
                        ? [...new Set([...selectedIds, region.id])]
                        : selectedIds.filter((id) => id !== region.id);
                      onChange({ mode: "custom", regionIds: nextIds });
                    }}
                  />
                  <span>{region.names.primary}</span>
                  <small>{region.coverage.status === "none" ? "未收录" : "覆盖有限"}</small>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </section>
  );
}
