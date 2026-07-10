export default function DashboardCard({ label, value, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    mint: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700"
  };

  return (
    <div className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lg">
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
