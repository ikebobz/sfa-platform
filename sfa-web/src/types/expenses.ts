export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Expense {
  id: number;
  rep_id: number;
  rep_name: string;
  expense_date: string;
  fuel_amount: number;
  litres: number | null;
  odometer_km: number | null;
  vehicle_service_cost: number;
  other_cost: number;
  total_cost: number;
  receipt_photo_url: string | null;
  approval_status: ApprovalStatus;
  approved_by: number | null;
}

export interface ExpenseFormValues {
  expenseDate: string;
  fuelAmount: number | "";
  litres: number | "";
  odometerKm: number | "";
  vehicleServiceCost: number | "";
  otherCost: number | "";
  receiptPhotoUrl: string;
}
