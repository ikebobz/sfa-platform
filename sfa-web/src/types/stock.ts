export interface StockBalance {
  rep_id: number;
  rep_name: string;
  product_id: number;
  product_name: string;
  quantity_on_hand: number;
}

export interface StockReceipt {
  id: number;
  rep_id: number;
  rep_name: string;
  product_id: number;
  product_name: string;
  quantity: number;
  received_date: string;
  notes: string | null;
}

export interface ReceiptFormValues {
  productId: number | "";
  quantity: number | "";
  receivedDate: string;
  notes: string;
}
