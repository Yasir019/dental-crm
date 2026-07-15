import { useEffect, useState } from "react";
import LoadingSpinner from "./components/LoadingSpinner";
import Toast from "./components/Toast";
import CrmLayout from "./layouts/CrmLayout";
import ArchivePage from "./pages/ArchivePage";
import CalendarPage from "./pages/CalendarPage";
import DashboardPage from "./pages/DashboardPage";
import FollowupPage from "./pages/FollowupPage";
import LeadsPage from "./pages/LeadsPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import LoginPage from "./pages/LoginPage";
import PublicLeadFormPage from "./pages/PublicLeadFormPage";
import SettingsPage from "./pages/SettingsPage";
import SourcesPage from "./pages/SourcesPage";
import { authService } from "./services/authService";
import { leadsService } from "./services/leadsService";

const crmPathToPage = {
  "/crm": "dashboard",
  "/crm/login": "login",
  "/crm/leads": "leads",
  "/crm/leads/website-form": "leads-website-form",
  "/crm/leads/google-form": "leads-google-form",
  "/crm/leads/ai-chatbot": "leads-ai-chatbot",
  "/crm/leads/ai-voice": "leads-ai-voice",
  "/crm/followup": "followup",
  "/crm/calendar": "calendar",
  "/crm/archive": "archive",
  "/crm/sources": "sources",
  "/crm/settings": "settings"
};

const pageToCrmPath = {
  dashboard: "/crm",
  leads: "/crm/leads",
  "leads-website-form": "/crm/leads/website-form",
  "leads-google-form": "/crm/leads/google-form",
  "leads-ai-chatbot": "/crm/leads/ai-chatbot",
  "leads-ai-voice": "/crm/leads/ai-voice",
  followup: "/crm/followup",
  calendar: "/crm/calendar",
  archive: "/crm/archive",
  sources: "/crm/sources",
  settings: "/crm/settings"
};

export default function App() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const leadDetailMatch = !crmPathToPage[route] ? route.match(/^\/crm\/leads\/([^/]+)$/) : null;
  const leadId = leadDetailMatch?.[1] || "";
  const page = crmPathToPage[route] || (leadId ? "lead-detail" : "dashboard");

  function showToast(nextToast) {
    setToast({ type: "success", ...nextToast });
    window.setTimeout(() => setToast(null), 4200);
  }

  function navigate(path) {
    window.history.pushState({}, "", path);
    setRoute(path);
  }

  useEffect(() => {
    function handlePopState() {
      setRoute(window.location.pathname);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!route.startsWith("/crm") || !user) return;

    let ignore = false;
    setLoading(true);
    leadsService
      .getLeads()
      .then((data) => {
        if (!ignore) setLeads(data.leads || []);
      })
      .catch((error) => {
        if (!ignore) showToast({ type: "error", title: "Could not load leads", message: error.message });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [page, route, user]);

  useEffect(() => {
    const token = localStorage.getItem("dentalLeadAuthToken");
    if (!token) {
      setAuthChecking(false);
      return;
    }

    authService
      .me()
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("dentalLeadAuthToken");
        setUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  function handleLogin(nextUser) {
    setUser(nextUser);
    navigate("/crm");
  }

  function handleLogout() {
    localStorage.removeItem("dentalLeadAuthToken");
    setUser(null);
    setLeads([]);
    navigate("/");
    showToast({ title: "Logged out", message: "CRM session ended." });
  }

  function handleCrmNavigate(nextPage) {
    navigate(pageToCrmPath[nextPage] || "/crm");
  }

  function handleLeadUpdated(updatedLead) {
    setLeads((current) => current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)));
  }

  return (
    <>
      {route === "/" ? (
        <PublicLeadFormPage showToast={showToast} />
      ) : route === "/stafflogin" || route === "/login" || route === "/crm/login" ? (
        <LoginPage onLogin={handleLogin} onBack={() => navigate("/")} showToast={showToast} />
      ) : route.startsWith("/crm") ? (
        authChecking ? (
          <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <LoadingSpinner label="Restoring CRM session" />
          </div>
        ) : user ? (
          <CrmLayout currentPage={page} onNavigate={handleCrmNavigate} user={user} onLogout={handleLogout}>
            {loading ? (
              <LoadingSpinner label="Loading CRM data" />
            ) : (
              <>
                {page === "dashboard" && <DashboardPage leads={leads} />}
                {page === "leads" && <LeadsPage leads={leads} setLeads={setLeads} showToast={showToast} onViewLead={(lead) => navigate(`/crm/leads/${lead.id}`)} />}
                {page === "leads-website-form" && <LeadsPage leads={leads} setLeads={setLeads} showToast={showToast} onViewLead={(lead) => navigate(`/crm/leads/${lead.id}`)} sourceFilter="Website Form" />}
                {page === "leads-google-form" && <LeadsPage leads={leads} setLeads={setLeads} showToast={showToast} onViewLead={(lead) => navigate(`/crm/leads/${lead.id}`)} sourceFilter="Google Form" />}
                {page === "leads-ai-chatbot" && <LeadsPage leads={leads} setLeads={setLeads} showToast={showToast} onViewLead={(lead) => navigate(`/crm/leads/${lead.id}`)} sourceFilter="AI Chatbot" />}
                {page === "leads-ai-voice" && <LeadsPage leads={leads} setLeads={setLeads} showToast={showToast} onViewLead={(lead) => navigate(`/crm/leads/${lead.id}`)} sourceFilter="AI Voice Agent" />}
                {page === "lead-detail" && (
                  <LeadDetailPage
                    leadId={leadId}
                    cachedLead={leads.find((lead) => lead.id === leadId)}
                    onBack={() => navigate("/crm/leads")}
                    onLeadUpdated={handleLeadUpdated}
                    showToast={showToast}
                  />
                )}
                {page === "followup" && <FollowupPage leads={leads} setLeads={setLeads} showToast={showToast} />}
                {page === "calendar" && <CalendarPage leads={leads} showToast={showToast} />}
                {page === "archive" && <ArchivePage showToast={showToast} />}
                {page === "sources" && <SourcesPage />}
                {page === "settings" && <SettingsPage user={user} setUser={setUser} showToast={showToast} />}
              </>
            )}
          </CrmLayout>
        ) : (
          <LoginPage onLogin={handleLogin} onBack={() => navigate("/")} showToast={showToast} />
        )
      ) : (
        <PublicLeadFormPage showToast={showToast} />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
