export interface Product {
  id: number;
  name: string;
  category: string | null;
  sku: string | null;
  unit_price: number;
}

export interface VisitPlan {
  id: number;
  rep_id: number;
  rep_name: string;
  customer_id: number;
  business_name: string;
  planned_date: string;
  product_to_detail_id: number | null;
  objective: string | null;
  status: "planned" | "completed" | "missed";
}

export interface RepSummary {
  id: number;
  name: string;
  territory_id: number | null;
}
