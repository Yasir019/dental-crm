import { useEffect, useState } from "react";
import { Archive, Bot, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FileText, GitBranch, Globe2, LayoutDashboard, LogOut, Menu, Mic, PhoneCall, Settings, X } from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    id: "leads",
    label: "Leads",
    icon: ClipboardList,
    children: [
      { id: "leads-website-form", label: "Website Form", icon: Globe2 },
      { id: "leads-google-form", label: "Google Form", icon: FileText },
      { id: "leads-ai-chatbot", label: "AI Chatbot", icon: Bot },
      { id: "leads-ai-voice", label: "AI Voice", icon: Mic }
    ]
  },
  { id: "followup", label: "Followup", icon: PhoneCall },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "sources", label: "Sources", icon: GitBranch },
  { id: "settings", label: "Settings", icon: Settings }
];

export default function Sidebar({ currentPage, onNavigate, collapsed, setCollapsed, mobileOpen, setMobileOpen, onLogout }) {
  const [openMenus, setOpenMenus] = useState(() => ({
    leads: currentPage === "leads" || currentPage.startsWith("leads-")
  }));

  useEffect(() => {
    if (currentPage === "leads" || currentPage.startsWith("leads-")) {
      setOpenMenus((current) => ({ ...current, leads: true }));
    }
  }, [currentPage]);

  function toggleMenu(id) {
    setOpenMenus((current) => ({ ...current, [id]: !current[id] }));
  }

  const sidebarContent = (
    <aside
      className={`crm-sidebar flex h-full flex-col text-white shadow-soft transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="crm-sidebar-brand flex items-center justify-between px-5 py-5">
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
          const active = currentPage === item.id || (item.id === "leads" && currentPage.startsWith("leads-"));
          const open = Boolean(openMenus[item.id]);
          return (
            <div key={item.id}>
              <div
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                    active ? "crm-nav-active bg-white text-emerald-700 shadow" : "crm-nav-inactive text-emerald-50 hover:bg-white/15"
                }`}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    onNavigate(item.id);
                    if (item.children) setOpenMenus((current) => ({ ...current, [item.id]: true }));
                    setMobileOpen(false);
                  }}
                >
                  <Icon size={21} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
                {!collapsed && item.children && (
                  <button
                    className={`rounded-md p-1 transition ${active ? "hover:bg-emerald-50" : "hover:bg-white/15"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleMenu(item.id);
                    }}
                    aria-label={open ? `Close ${item.label} menu` : `Open ${item.label} menu`}
                  >
                    {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                  </button>
                )}
              </div>
              {!collapsed && item.children && open && (
                <div className="mt-2 space-y-1 border-l border-white/25 pl-5">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = currentPage === child.id;
                    return (
                      <button
                        key={child.id}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                          childActive ? "crm-nav-active bg-white/95 text-emerald-700" : "crm-nav-inactive text-emerald-50 hover:bg-white/15"
                        }`}
                        onClick={() => {
                          onNavigate(child.id);
                          setMobileOpen(false);
                        }}
                      >
                        <ChildIcon size={16} />
                        <span>{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-5">
        <button
          className="crm-nav-inactive flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-emerald-50 transition hover:bg-white/15"
          onClick={onLogout}
        >
          <LogOut size={21} />
          {!collapsed && <span>Logout</span>}
        </button>
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
