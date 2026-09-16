import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./pages/Login";
import { DashboardOverview } from "./pages/dashboard/DashboardOverview";
import { DebtLedger } from "./pages/dashboard/DebtLedger";
import { Planning } from "./pages/Planning";
import { Customers } from "./pages/Customers";
import { SalesRedistribution } from "./pages/Sales";
import { Expenses } from "./pages/Expenses";
import { ComingSoon } from "./pages/ComingSoon";

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
            <Route path="/customers" element={<Customers />} />
            <Route path="/sales" element={<SalesRedistribution />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/incentives" element={<ComingSoon title="Incentives" />} />
            <Route path="/reports" element={<ComingSoon title="Reports" />} />
            <Route path="/admin/users" element={<ComingSoon title="Users & Territories" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
