import { CheckCircle2, XCircle } from "lucide-react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === "error";

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-lg border border-emerald-100 bg-white p-4 shadow-soft">
      <div className="flex gap-3">
        <div className={isError ? "text-red-500" : "text-emerald-600"}>
          {isError ? <XCircle size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{toast.title}</p>
          {toast.message && <p className="mt-1 text-sm text-gray-500">{toast.message}</p>}
        </div>
        <button className="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Close notification">
          x
        </button>
      </div>
    </div>
  );
}
