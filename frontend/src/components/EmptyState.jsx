import { Inbox } from "lucide-react";

export default function EmptyState({ title = "No records found", message = "New activity will appear here." }) {
  return (
    <div className="rounded-lg border border-emerald-100 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Inbox size={24} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  );
}
