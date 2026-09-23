export type IncentiveStatus = "pending" | "qualified" | "paid";

export interface Incentive {
  id: number;
  rep_id: number;
  rep_name: string;
  period: string;
  product_id: number | null;
  product_name: string | null;
  metric_value: number;
  status: IncentiveStatus;
  amount_rep: number;
  amount_rsm: number;
  amount_nsm: number;
}
