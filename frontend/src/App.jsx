import { useEffect, useState } from "react";
import LoadingSpinner from "./components/LoadingSpinner";
import Toast from "./components/Toast";
import CrmLayout from "./layouts/CrmLayout";
import ArchivePage from "./pages/ArchivePage";
import DashboardPage from "./pages/DashboardPage";
import FollowupPage from "./pages/FollowupPage";
import LeadsPage from "./pages/LeadsPage";
import LoginPage from "./pages/LoginPage";
import PublicLeadFormPage from "./pages/PublicLeadFormPage";
import SettingsPage from "./pages/SettingsPage";
import SourcesPage from "./pages/SourcesPage";
import { authService } from "./services/authService";
import { leadsService } from "./services/leadsService";

const crmPathToPage = {
  "/crm": "dashboard",
  "/crm/leads": "leads",
  "/crm/followup": "followup",
  "/crm/archive": "archive",
  "/crm/sources": "sources",
  "/crm/settings": "settings"
};

const pageToCrmPath = {
  dashboard: "/crm",
  leads: "/crm/leads",
  followup: "/crm/followup",
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
  const page = crmPathToPage[route] || "dashboard";

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

  return (
    <>
      {route === "/" ? (
        <PublicLeadFormPage showToast={showToast} />
      ) : route === "/stafflogin" ? (
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
                {page === "leads" && <LeadsPage leads={leads} setLeads={setLeads} showToast={showToast} />}
                {page === "followup" && <FollowupPage leads={leads} setLeads={setLeads} showToast={showToast} />}
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
