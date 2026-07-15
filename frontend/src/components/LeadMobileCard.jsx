import { Archive, Eye, Mic, Pencil } from "lucide-react";
import { STATUSES } from "../utils/constants";
import { formatDateTime } from "../utils/formatters";

export default function LeadMobileCard({ lead, onStatusChange, onView, onEdit, onArchive, onVoiceDetails, disabled, archiving }) {
  return (
    <div className="rounded-lg border border-emerald-100 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">{lead.name}</h3>
          <p className="text-sm text-gray-500">{formatDateTime(lead.timestamp)}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{lead.service}</span>
      </div>
      <div className="mt-4 space-y-2 text-sm text-gray-600">
        <p>{lead.phone}</p>
        <p>{lead.email}</p>
        <p>Followup: {lead.followup}</p>
        <p>Source: {lead.source || "Website Form"}</p>
        {lead.notes && <p>Notes: {lead.notes}</p>}
      </div>
      <select className="form-input mt-4" value={lead.status} disabled={disabled} onChange={(event) => onStatusChange(lead.id, event.target.value)}>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" onClick={() => onView(lead)}>
          <Eye size={16} /> Open
        </button>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => onEdit(lead)}>
          <Pencil size={16} />
          Edit
        </button>
        <button
          className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          onClick={() => onArchive(lead)}
          disabled={archiving}
        >
          <Archive size={16} />
          Archive
        </button>
        {lead.source === "AI Voice Agent" && (
          <button
            className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            onClick={() => onVoiceDetails(lead)}
          >
            <Mic size={16} />
            Recording & Transcript
          </button>
        )}
      </div>
    </div>
  );
}
