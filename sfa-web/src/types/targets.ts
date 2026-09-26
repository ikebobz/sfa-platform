export type PeriodType = "day" | "week" | "month" | "quarter";

export interface RepTargetRow {
  repId: number;
  repName: string;
  target: number | null;
  actual: number;
  attainmentPct: number | null;
  status: "good" | "watch" | "poor" | "no_target";
  isOverride: boolean;
}

export interface RepTargetsResponse {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  defaultTarget: number | null;
  rows: RepTargetRow[];
}
