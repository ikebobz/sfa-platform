export type Role = "rep" | "rsm" | "nsm" | "admin";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  territory_id: number | null;
  status: "active" | "inactive";
  created_at: string;
}

export interface UserFormValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  territoryId: number | "";
  status: "active" | "inactive";
}

export const emptyUserForm: UserFormValues = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "rep",
  territoryId: "",
  status: "active",
};
