export interface Customer {
  id: number;
  business_name: string;
  business_type: string | null;
  address: string | null;
  town: string | null;
  lga: string | null;
  state: string | null;
  region: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
  territory_id: number;
  last_visit_date: string | null;
  last_supply_date: string | null;
}

export interface CustomerFormValues {
  businessName: string;
  businessType: string;
  address: string;
  town: string;
  lga: string;
  state: string;
  region: string;
  contactPerson: string;
  phone: string;
  email: string;
  territoryId: number | "";
}

export const emptyCustomerForm: CustomerFormValues = {
  businessName: "",
  businessType: "",
  address: "",
  town: "",
  lga: "",
  state: "",
  region: "",
  contactPerson: "",
  phone: "",
  email: "",
  territoryId: "",
};
