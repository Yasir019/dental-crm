import { Copy, Mail, X } from "lucide-react";

export default function AiTemplateModal({ lead, template, loading, sending, onClose, onCopy, onSend }) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-soft">
        <div className="flex items-start justify-between border-b border-emerald-100 p-5">
          <div>
            <p className="text-sm font-semibold text-emerald-700">AI Follow-up Template</p>
            <h3 className="text-xl font-bold text-gray-900">{lead.name}</h3>
          </div>
          <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-emerald-700">Generating a polished follow-up...</div>
          ) : (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700">Subject</span>
                <input className="form-input" value={template?.subject || ""} readOnly />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700">Email Body</span>
                <textarea className="form-input min-h-56" value={template?.body || ""} readOnly />
              </label>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-emerald-100 p-5 sm:flex-row sm:justify-end">
          <button className="rounded-lg border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50" onClick={onCopy} disabled={!template || loading}>
            <span className="inline-flex items-center gap-2">
              <Copy size={17} /> Copy
            </span>
          </button>
          <button
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-2 font-semibold text-white disabled:opacity-60"
            onClick={onSend}
            disabled={!template || loading || sending}
          >
            <span className="inline-flex items-center gap-2">
              <Mail size={17} /> {sending ? "Sending..." : "Send Email"}
            </span>
          </button>
          <button className="rounded-lg px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
