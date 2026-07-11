import { Archive, Mic, Pencil } from "lucide-react";
import { STATUSES } from "../utils/constants";
import { formatDateTime } from "../utils/formatters";
import LeadMobileCard from "./LeadMobileCard";
import Pagination from "./Pagination";

export default function LeadsTable({ leads, page, totalPages, onPageChange, onStatusChange, onEdit, onArchive, onVoiceDetails, updatingId, archivingId, showSourceColumn = true }) {
  const headers = ["Time", "Name", "Phone", "Email", "Service"];
  if (showSourceColumn) headers.push("Source");
  headers.push("Followup", "Mark As", "Actions");

  return (
    <div className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-soft">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-emerald-100">
          <thead className="bg-emerald-50">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-emerald-800">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {leads.map((lead) => (
              <tr key={lead.id} className="transition hover:bg-emerald-50/60">
                <td className="px-4 py-4 text-sm text-gray-600">{formatDateTime(lead.timestamp)}</td>
                <td className="px-4 py-4 font-semibold text-gray-900">{lead.name}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.phone}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.email}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.service}</td>
                {showSourceColumn && (
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {lead.source || "Website Form"}
                    </span>
                  </td>
                )}
                <td className="px-4 py-4 text-sm text-gray-600">{lead.followup}</td>
                <td className="px-4 py-4">
                  <select className="form-input min-w-40" value={lead.status} disabled={updatingId === lead.id} onChange={(event) => onStatusChange(lead.id, event.target.value)}>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => onEdit(lead)}
                      title="Edit lead"
                    >
                      <Pencil size={16} />
                    </button>
                    {lead.source === "AI Voice Agent" && (
                      <button
                        className="rounded-lg border border-blue-200 p-2 text-blue-700 hover:bg-blue-50"
                        onClick={() => onVoiceDetails(lead)}
                        title="View recording and transcript"
                      >
                        <Mic size={16} />
                      </button>
                    )}
                    <button
                      className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => onArchive(lead)}
                      disabled={archivingId === lead.id}
                      title="Archive lead"
                    >
                      <Archive size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 p-4 md:hidden">
        {leads.map((lead) => (
          <LeadMobileCard
            key={lead.id}
            lead={lead}
            disabled={updatingId === lead.id}
            archiving={archivingId === lead.id}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onArchive={onArchive}
            onVoiceDetails={onVoiceDetails}
          />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
