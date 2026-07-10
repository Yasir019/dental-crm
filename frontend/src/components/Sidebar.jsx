import { Archive, ClipboardList, GitBranch, LayoutDashboard, LogOut, Menu, PhoneCall, Settings, X } from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: ClipboardList },
  { id: "followup", label: "Followup", icon: PhoneCall },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "sources", label: "Sources", icon: GitBranch },
  { id: "settings", label: "Settings", icon: Settings }
];

export default function Sidebar({ currentPage, onNavigate, collapsed, setCollapsed, mobileOpen, setMobileOpen, onLogout }) {
  const sidebarContent = (
    <aside
      className={`flex h-full flex-col bg-gradient-to-b from-emerald-700 to-emerald-500 text-white shadow-soft transition-all duration-300 ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-5">
        <div className={`overflow-hidden transition-all ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">DentalLead</p>
          <h1 className="text-xl font-bold">CRM</h1>
        </div>
        <button
          className="hidden rounded-lg bg-white/10 p-2 hover:bg-white/20 lg:block"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <button className="rounded-lg bg-white/10 p-2 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      <nav className="mt-4 space-y-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                active ? "bg-white text-emerald-700 shadow" : "text-emerald-50 hover:bg-white/15"
              }`}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
            >
              <Icon size={21} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-5">
        <button
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-emerald-50 transition hover:bg-white/15"
          onClick={onLogout}
        >
          <LogOut size={21} />
          {!collapsed && <span>Logout</span>}
        </button>
        <div className={`mt-3 px-2 text-sm text-emerald-50 ${collapsed ? "hidden" : "block"}`}>
          <p className="font-semibold">Dental clinic lead care</p>
          <p className="mt-1 text-emerald-100">Track inquiries, qualify leads, and manage friendly follow-ups.</p>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebarContent}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-gray-900/40" onClick={() => setMobileOpen(false)} aria-label="Close menu overlay" />
          <div className="relative h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
