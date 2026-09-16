export interface DashboardOverview {
  filters: { territoryId?: number; from?: string; to?: string };
  database: {
    totalCustomers: number;
    activeCustomers: number;
    activeRatio: number;
    verdict: string;
  };
  visits: { totalVisits: number };
  revenue: {
    total: number;
    topProducts: { id: number; name: string; revenue: number }[];
    topCustomers: { id: number; business_name: string; revenue: number }[];
    bottomCustomers: { id: number; business_name: string; revenue: number }[];
  };
  expenses: { total: number };
  debt: { total: number };
}

export interface DebtRow {
  customerId: number;
  businessName: string;
  territoryId: number | null;
  balance: number;
  riskLevel: "good" | "watch" | "poor";
}

export interface Territory {
  id: number;
  name: string;
  region: string;
  state: string;
}
