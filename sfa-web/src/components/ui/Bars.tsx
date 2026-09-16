export function BarRow({
  label,
  value,
  displayValue,
  maxValue,
}: {
  label: string;
  value: number;
  displayValue: string;
  maxValue: number;
}) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 mb-2.5 text-[12.5px]">
      <div className="w-28 flex-shrink-0 text-ink-soft truncate">{label}</div>
      <div className="flex-1 h-2 bg-track rounded overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 text-right tabular-nums">{displayValue}</div>
    </div>
  );
}

export function ProgressBar({
  label,
  currentDisplay,
  limitDisplay,
  pct,
  overLimit,
}: {
  label: string;
  currentDisplay: string;
  limitDisplay: string;
  pct: number;
  overLimit: boolean;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex justify-between text-[12.5px] mb-1">
        <span>{label}</span>
        <span className="tabular-nums">
          {currentDisplay} / {limitDisplay}
        </span>
      </div>
      <div className="h-2 bg-track rounded overflow-hidden">
        <div
          className={`h-full ${overLimit ? "bg-poor" : "bg-good"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
