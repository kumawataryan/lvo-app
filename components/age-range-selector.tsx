"use client";

const AGE_RANGE_OPTIONS = Array.from({ length: 19 }, (_, age) => age);

export function AgeRangeSelector({
  minimumAge,
  maximumAge,
  onChange,
  allowClear = false,
  className = "",
}: {
  minimumAge: number | null;
  maximumAge: number | null;
  onChange: (minimumAge: number | null, maximumAge: number | null) => void;
  allowClear?: boolean;
  className?: string;
}) {
  const hasRange = minimumAge !== null && maximumAge !== null;

  return (
    <div className={className}>
      <div className="grid grid-cols-7 gap-2" role="group" aria-label={hasRange ? `Selected age range ${minimumAge} to ${maximumAge}` : "No age range selected"}>
        {AGE_RANGE_OPTIONS.map((age) => {
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
