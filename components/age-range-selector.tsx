"use client";

const MAX_AGE = 16;

export function AgeRangeSelector({
  minimumAge,
  maximumAge,
  onChange,
  allowClear = false,
  startAge = 0,
  className = "",
}: {
  minimumAge: number | null;
  maximumAge: number | null;
  onChange: (minimumAge: number | null, maximumAge: number | null) => void;
  allowClear?: boolean;
  // Youngest age offered; the filters start at 2, the template form at 0.
  startAge?: number;
  className?: string;
}) {
  const hasRange = minimumAge !== null && maximumAge !== null;
  const ages = Array.from({ length: MAX_AGE - startAge + 1 }, (_, index) => startAge + index);
  // 17 ages (0–16) fit 7 per row; 15 ages (2–16) fit 5 per row with no ragged last row.
  const columns = ages.length % 5 === 0 ? "grid-cols-5" : "grid-cols-7";

  return (
    <div className={className}>
      <div className={`grid ${columns} gap-2`} role="group" aria-label={hasRange ? `Selected age range ${minimumAge} to ${maximumAge}` : "No age range selected"}>
        {ages.map((age) => {
          const selected = hasRange && age >= minimumAge && age <= maximumAge;
          return (
            <button
              key={age}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (minimumAge === null || maximumAge === null) { onChange(age, age); return; }
                if (age < minimumAge) onChange(age, maximumAge);
                else if (age > maximumAge) onChange(minimumAge, age);
                else if (age - minimumAge <= maximumAge - age) onChange(age, maximumAge);
                else onChange(minimumAge, age);
              }}
              className={`flex h-9 items-center justify-center rounded-lg text-sm font-medium transition active:scale-95 ${selected ? "bg-brand text-white" : "bg-[#f2f2f2] text-black/60"}`}
            >
              {age}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-black/35">{hasRange ? `Selected: ${minimumAge}–${maximumAge} years` : "Any age"}</p>
        {allowClear && hasRange ? (
          <button type="button" onClick={() => onChange(null, null)} className="text-xs font-medium text-black/45 transition hover:text-black/70">
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
