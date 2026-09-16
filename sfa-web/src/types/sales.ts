export type PaymentStatus = "full_payment" | "part_payment" | "credit";

export interface Sale {
  id: number;
  visit_id: number | null;
  customer_id: number;
  business_name: string;
  product_id: number;
  product_name: string;
  rep_id: number;
  rep_name: string;
  quantity: number;
  unit_price: number;
  revenue: number;
  payment_status: PaymentStatus;
  amount_paid: number;
  sale_date: string;
}

export interface SaleFormValues {
  customerId: number | "";
  productId: number | "";
  quantity: number | "";
  paymentStatus: PaymentStatus;
  amountPaid: number | "";
  saleDate: string;
}
