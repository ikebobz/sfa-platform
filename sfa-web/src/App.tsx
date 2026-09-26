import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./pages/Login";
import { DashboardOverview } from "./pages/dashboard/DashboardOverview";
import { DebtLedger } from "./pages/dashboard/DebtLedger";
import { Planning } from "./pages/Planning";
import { Visits } from "./pages/Visits";
import { Customers } from "./pages/Customers";
import { SalesRedistribution } from "./pages/Sales";
import { Stock } from "./pages/Stock";
import { Expenses } from "./pages/Expenses";
import { Incentives } from "./pages/Incentives";
import { Reports } from "./pages/Reports";
import { UsersTerritories } from "./pages/UsersTerritories";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardOverview />} />
            <Route path="/debt-ledger" element={<DebtLedger />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/visits" element={<Visits />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/sales" element={<SalesRedistribution />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/incentives" element={<Incentives />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin/users" element={<UsersTerritories />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
