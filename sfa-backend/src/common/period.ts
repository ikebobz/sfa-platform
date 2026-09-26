export type PeriodType = "day" | "week" | "month" | "quarter";

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves the current period's boundaries as "period-to-date": the start of
 * the period (day/week/month/quarter, today's calendar position within it) is
 * the start date, and today is the end date. This is deliberately a
 * pacing view ("how are we doing so far this month"), not a completed-period
 * view — a target for the current month is still meaningful on day 3 of it.
 *
 * Week starts Monday (ISO 8601), not Sunday.
 */
export function resolvePeriodBounds(periodType: PeriodType, now: Date = new Date()): { start: string; end: string } {
  const end = toISO(now);

  if (periodType === "day") {
    return { start: end, end };
  }

  if (periodType === "week") {
    const day = now.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    return { start: toISO(monday), end };
  }

  if (periodType === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toISO(start), end };
  }

  // quarter
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  return { start: toISO(start), end };
}
