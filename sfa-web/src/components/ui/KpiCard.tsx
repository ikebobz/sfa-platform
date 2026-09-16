export type VerdictTone = "good" | "watch" | "poor" | "neutral";

const verdictBorder: Record<VerdictTone, string> = {
  good: "border-good",
  watch: "border-watch",
  poor: "border-poor",
  neutral: "border-border",
};

export function KpiCard({
  label,
  value,
  verdict,
  tone = "neutral",
}: {
  label: string;
  value: string;
  verdict?: string;
  tone?: VerdictTone;
}) {
  return (
    <div className="flex-1 px-5 py-4 border-r border-border last:border-r-0">
      <p className="text-xs text-ink-soft mb-1.5">{label}</p>
      <p className="font-serif text-2xl leading-none text-ink">{value}</p>
      {verdict && (
        <p className={`mt-2.5 pl-2 text-[11.5px] text-ink-soft border-l-2 ${verdictBorder[tone]}`}>
          {verdict}
        </p>
      )}
    </div>
  );
}

const riskTagClasses: Record<"good" | "watch" | "poor", string> = {
  good: "bg-good-bg text-good",
  watch: "bg-watch-bg text-watch",
  poor: "bg-poor-bg text-poor",
};

export function RiskTag({ level }: { level: "good" | "watch" | "poor" }) {
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded ${riskTagClasses[level]}`}>
      {label}
    </span>
  );
}
