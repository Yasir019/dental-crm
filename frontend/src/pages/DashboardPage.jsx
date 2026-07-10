import { CheckCircle2, ClipboardList, GitBranch, TrendingUp, XCircle } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import EmptyState from "../components/EmptyState";
import QualificationBarChart from "../components/QualificationBarChart";
import ServicePieChart from "../components/ServicePieChart";
import { LEAD_SOURCES, SERVICES } from "../utils/constants";
import { isToday } from "../utils/formatters";

export default function DashboardPage({ leads }) {
  const metrics = {
    total: leads.length,
    today: leads.filter((lead) => isToday(lead.timestamp)).length,
    qualified: leads.filter((lead) => lead.status === "Qualified").length,
    notQualified: leads.filter((lead) => lead.status === "Not Qualified").length,
    aiVoice: leads.filter((lead) => lead.source === "AI Voice Agent").length
  };

  const serviceData = SERVICES.map((service) => ({
    name: service,
    value: leads.filter((lead) => lead.service === service).length
  })).filter((item) => item.value > 0);

  const qualificationData = [
    { name: "Qualified", value: metrics.qualified },
    { name: "Not Qualified", value: metrics.notQualified }
  ];

  const sourceData = LEAD_SOURCES.map((source) => ({
    name: source,
    value: leads.filter((lead) => (lead.source || "Website Form") === source).length
  })).filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardCard label="Total Leads" value={metrics.total} icon={ClipboardList} />
        <DashboardCard label="Today Leads" value={metrics.today} icon={TrendingUp} tone="mint" />
        <DashboardCard label="Qualified Leads" value={metrics.qualified} icon={CheckCircle2} tone="emerald" />
        <DashboardCard label="Not Qualified Leads" value={metrics.notQualified} icon={XCircle} tone="rose" />
        <DashboardCard label="AI Voice Leads" value={metrics.aiVoice} icon={GitBranch} tone="mint" />
      </div>

      {leads.length === 0 ? (
        <EmptyState title="No leads yet" message="New dental inquiries will populate dashboard analytics." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-bold text-gray-900">Leads by Service</h3>
            <ServicePieChart data={serviceData} />
          </section>
          <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-bold text-gray-900">Leads by Source</h3>
            <ServicePieChart data={sourceData} />
          </section>
          <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-bold text-gray-900">Qualification Overview</h3>
            <QualificationBarChart data={qualificationData} />
          </section>
        </div>
      )}
    </div>
  );
}
