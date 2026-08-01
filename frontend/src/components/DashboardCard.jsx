export default function DashboardCard({ label, value, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "bg-[#BAFF98] text-[#16351d]",
    mint: "bg-[#eff9eb] text-[#07835d]",
    amber: "bg-[#fff8df] text-[#9a6b00]",
    rose: "bg-[#fff0f1] text-[#c81e4b]"
  };

  return (
    <div className="dashboard-metric-card rounded-lg border border-emerald-100 bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
