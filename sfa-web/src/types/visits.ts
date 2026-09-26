// Mirrors VISIT_ACTIVITY_TYPES in the backend's visit-logs.routes.ts.
// Keep these two lists in sync manually if you add a value — there's no
// shared source between frontend and backend for this fixed list.
export const VISIT_ACTIVITY_OPTIONS = [
  { value: "product_detailing", label: "Product detailing" },
  { value: "sample_distribution", label: "Sample distribution" },
  { value: "order_placed", label: "Order placed" },
  { value: "payment_collection", label: "Payment collection" },
  { value: "merchandising", label: "Merchandising" },
  { value: "complaint_handling", label: "Complaint handling" },
  { value: "training_education", label: "Training / education" },
  { value: "relationship_building", label: "Relationship building" },
  { value: "other", label: "Other" },
] as const;

export type VisitActivityType = (typeof VISIT_ACTIVITY_OPTIONS)[number]["value"];

export interface VisitLog {
  id: number;
  plan_id: number | null;
  rep_id: number;
  rep_name: string;
  customer_id: number;
  business_name: string;
  visit_date: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  activities: string[];
  products_discussed: number[];
  created_at: string;
}

export interface VisitLogFormValues {
  planId: number | "";
  customerId: number | "";
  visitDate: string;
  notes: string;
  activities: VisitActivityType[];
  productsDiscussed: number[];
}
