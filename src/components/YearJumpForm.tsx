import { useEffect, useId, useState, type FormEvent } from "react";

import type { HistoricalYearBounds } from "../domain/browseState";
import { formatHistoricalYear } from "../domain/chronology";

interface YearJumpFormProps {
  year: number;
  yearBounds: HistoricalYearBounds;
  onYearChange: (year: number) => void;
}

type HistoricalEra = "bce" | "ce";

function getYearDraft(year: number) {
  return {
    era: year < 0 ? ("bce" as const) : ("ce" as const),
    value: String(Math.abs(year))
  };
}

/** 按纪元与年份精确跳转；校验不存在的公元 0 年和数据年份范围。 */
export function YearJumpForm({ year, yearBounds, onYearChange }: YearJumpFormProps) {
  const [yearDraft, setYearDraft] = useState(() => getYearDraft(year));
  const [yearInputError, setYearInputError] = useState<string | null>(null);
  const yearInputErrorId = useId();

  useEffect(() => {
    setYearDraft(getYearDraft(year));
    setYearInputError(null);
  }, [year]);

  const submitYear = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = yearDraft.value.trim();

    if (!normalized) {
      setYearInputError("请输入年份。");
      return;
    }
    if (!/^\d+$/.test(normalized)) {
      setYearInputError("年份必须是大于 0 的整数。");
      return;
    }

    const absoluteYear = Number(normalized);
    if (!Number.isSafeInteger(absoluteYear)) {
      setYearInputError("请输入有效的整数年份。");
      return;
    }
    if (absoluteYear === 0) {
      setYearInputError("历史纪年不存在公元 0 年。");
      return;
    }

    const nextYear = yearDraft.era === "bce" ? -absoluteYear : absoluteYear;
    if (nextYear < yearBounds.min || nextYear > yearBounds.max) {
      setYearInputError(
        `可跳转范围为${formatHistoricalYear({ year: yearBounds.min, precision: "exact" })}至${formatHistoricalYear({ year: yearBounds.max, precision: "exact" })}。`
      );
      return;
    }

    setYearDraft((current) => ({ ...current, value: String(absoluteYear) }));
    setYearInputError(null);
    onYearChange(nextYear);
  };

  return (
    <form className="year-jump-form" onSubmit={submitYear} noValidate>
      <span className="year-jump-label">精确跳转</span>
      <div className="year-jump-controls">
        <select
          className="year-era-select"
          aria-label="纪元"
          value={yearDraft.era}
          onChange={(event) => {
            const era = event.currentTarget.value as HistoricalEra;
            setYearDraft((current) => ({
              ...current,
              era
            }));
            setYearInputError(null);
          }}
        >
          <option value="bce">公元前</option>
          <option value="ce">公元</option>
        </select>
        <input
          className="year-number-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="年份"
          aria-invalid={yearInputError ? "true" : "false"}
          {...(yearInputError ? { "aria-describedby": yearInputErrorId } : {})}
          value={yearDraft.value}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setYearDraft((current) => ({ ...current, value }));
            setYearInputError(null);
          }}
        />
        <button className="year-jump-button" type="submit">
          跳转
        </button>
      </div>
      {yearInputError && (
        <p className="year-input-error" id={yearInputErrorId} role="alert">
          {yearInputError}
        </p>
      )}
    </form>
  );
}
