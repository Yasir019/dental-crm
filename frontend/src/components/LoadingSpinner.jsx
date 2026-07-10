export default function LoadingSpinner({ label = "Loading" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-emerald-700">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
