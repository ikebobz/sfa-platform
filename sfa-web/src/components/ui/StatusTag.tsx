const statusClasses: Record<string, string> = {
  active: "bg-good-bg text-good",
  inactive: "bg-[#EDEEE4] text-ink-soft",
  planned: "bg-[#E7ECF3] text-ink",
  completed: "bg-good-bg text-good",
  missed: "bg-poor-bg text-poor",
};

export function StatusTag({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded ${statusClasses[status] ?? "bg-track text-ink-soft"}`}>
      {label}
    </span>
  );
}
