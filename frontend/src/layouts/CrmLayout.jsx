import { Menu } from "lucide-react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";

const titles = {
  dashboard: "Dashboard",
  leads: "Leads Management",
  "leads-website-form": "Website Form Leads",
  "leads-google-form": "Google Form Leads",
  "leads-ai-chatbot": "AI Chatbot Leads",
  "leads-ai-voice": "AI Voice Leads",
  "lead-detail": "Lead Details",
  followup: "Follow-up Center",
  calendar: "Appointment Calendar",
  archive: "Archive",
  sources: "Lead Sources",
  settings: "Settings"
};

export default function CrmLayout({ currentPage, onNavigate, children, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={onLogout}
      />
      <main className={`min-w-0 transition-all duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/85 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-emerald-100 bg-white p-2 text-emerald-700 lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>
            <div>
              <p className="text-sm font-medium text-emerald-700">DentalLead CRM</p>
              <h2 className="text-2xl font-bold text-gray-900">{titles[currentPage]}</h2>
            </div>
            {user && (
              <div className="ml-auto hidden text-right sm:block">
                <p className="text-sm font-bold text-gray-900">{user.displayName}</p>
                <p className="text-xs text-gray-500">{user.clinicName}</p>
              </div>
            )}
          </div>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
