import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  roles?: Array<"rep" | "rsm" | "nsm" | "admin">;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview" },
  { to: "/planning", label: "Planning" },
  { to: "/visits", label: "Visits" },
  { to: "/customers", label: "Customers" },
  { to: "/sales", label: "Sales & Redistribution" },
  { to: "/stock", label: "Stock" },
  { to: "/debt-ledger", label: "Debt & Ledger" },
  { to: "/expenses", label: "Expenses" },
  { to: "/incentives", label: "Incentives" },
  { to: "/reports", label: "Reports", roles: ["admin", "nsm", "rsm"] },
  { to: "/admin/users", label: "Master Data", roles: ["admin"] },
];

export function AppShell() {
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex min-h-screen">
      <aside className="w-[232px] flex-shrink-0 bg-ink text-[#E8E9DE] px-5 py-7">
        <div className="font-serif text-lg mb-0.5">Territory Ledger</div>
        <div className="text-[11.5px] text-[#9AA3B8] mb-8">Sales Force Platform</div>

        <nav>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block px-2.5 py-2 mb-0.5 text-[13.5px] rounded ${
                  isActive
                    ? "bg-white/10 text-white border-l-2 border-accent pl-2"
                    : "text-[#C7CBD9] hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-10 pt-4 border-t border-white/10 text-[12px] text-[#9AA3B8]">
          <div className="text-white text-[13px] mb-0.5">{user?.name}</div>
          <div className="mb-3 capitalize">{user?.role}</div>
          <button onClick={logout} className="text-[#C7CBD9] hover:text-white underline">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-10 py-8 max-w-[1240px]">
        <Outlet />
      </main>
    </div>
  );
}
