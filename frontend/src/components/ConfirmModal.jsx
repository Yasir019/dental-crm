export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-100"
      : "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-100";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/45 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            onClick={onCancel}
            disabled={loading}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
