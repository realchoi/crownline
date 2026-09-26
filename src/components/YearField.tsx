import { useEffect, useId, useState, type FormEvent } from "react";

import type { HistoricalYearBounds } from "../domain/browseState";
import { formatHistoricalYear } from "../domain/chronology";

interface YearFieldProps {
  year: number;
  yearBounds: HistoricalYearBounds;
  /** 全时期时年份框留空，只保留最近浏览年份的纪元；提交后进入指定年份。 */
  isAllTime: boolean;
  onYearChange: (year: number) => void;
}

type HistoricalEra = "bce" | "ce";

interface YearDraft {
  era: HistoricalEra;
  value: string;
}

function getYearDraft(year: number, isAllTime: boolean): YearDraft {
  return {
    era: year < 0 ? "bce" : "ce",
    value: isAllTime ? "" : String(Math.abs(year))
  };
}

type ParsedYear = { year: number } | { error: string };

/** 校验纪元与正整数年份；不存在公元 0 年，并限制在数据年份范围内。 */
function parseYearDraft(draft: YearDraft, bounds: HistoricalYearBounds): ParsedYear {
  const normalized = draft.value.trim();
  if (!normalized) return { error: "请输入年份。" };
  if (!/^\d+$/.test(normalized)) return { error: "年份必须是大于 0 的整数。" };

  const absoluteYear = Number(normalized);
  if (!Number.isSafeInteger(absoluteYear)) return { error: "请输入有效的整数年份。" };
  if (absoluteYear === 0) return { error: "历史纪年不存在公元 0 年。" };

  const year = draft.era === "bce" ? -absoluteYear : absoluteYear;
  if (year < bounds.min || year > bounds.max) {
    return {
      error: `可跳转范围为${formatHistoricalYear({ year: bounds.min, precision: "exact" })}至${formatHistoricalYear({ year: bounds.max, precision: "exact" })}。`
    };
  }
  return { year };
}

/**
 * 当前年份的显示与改写合一：回车、点击“跳转”或改过后离开输入框即提交，改纪元立即生效。
 * 移动端数字键盘可能没有回车键，所以失焦提交是必要入口。
 */
export function YearField({ year, yearBounds, isAllTime, onYearChange }: YearFieldProps) {
  const [draft, setDraft] = useState(() => getYearDraft(year, isAllTime));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const current = getYearDraft(year, isAllTime);
  const isDirty = draft.value.trim() !== current.value || draft.era !== current.era;

  useEffect(() => {
    setDraft(getYearDraft(year, isAllTime));
    setError(null);
  }, [year, isAllTime]);

  const commit = (next: YearDraft) => {
    const parsed = parseYearDraft(next, yearBounds);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setDraft({ ...next, value: String(Math.abs(parsed.year)) });
    setError(null);
    if (isAllTime || parsed.year !== year) onYearChange(parsed.year);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commit(draft);
  };

  return (
    <form
      className={`year-field${isAllTime ? " is-overview" : ""}${error ? " is-invalid" : ""}`}
      onSubmit={submit}
      noValidate
    >
      <div className="year-field-controls">
        <select
          className="year-era-select"
          aria-label="纪元"
          value={draft.era}
          onChange={(event) => {
            const next = { ...draft, era: event.currentTarget.value as HistoricalEra };
            setDraft(next);
            setError(null);
            // 年份框留空时只记住纪元，等输入数字后再提交。
            if (next.value.trim()) commit(next);
          }}
        >
          <option value="bce">公元前</option>
          <option value="ce">公元</option>
        </select>
        <input
          className="year-number-input"
          type="text"
          inputMode="numeric"
          enterKeyHint="go"
          autoComplete="off"
          aria-label="年份"
          placeholder="输入年份"
          aria-invalid={error ? "true" : "false"}
          {...(error ? { "aria-describedby": errorId } : {})}
          value={draft.value}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDraft((currentDraft) => ({ ...currentDraft, value }));
            setError(null);
          }}
          onBlur={() => {
            if (!isDirty) return;
            // 清空后离开视为放弃修改，恢复当前值而不是报错。
            if (!draft.value.trim()) {
              setDraft(current);
              setError(null);
              return;
            }
            commit(draft);
          }}
        />
        <span className="year-field-unit" aria-hidden="true">
          年
        </span>
        {(isDirty || error) && (
          <button className="year-jump-button" type="submit">
            跳转
          </button>
        )}
      </div>
      {error && (
        <p className="year-input-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
