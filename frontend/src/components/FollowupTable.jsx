import { Mail, PhoneCall } from "lucide-react";
import { formatDateTime } from "../utils/formatters";
import Pagination from "./Pagination";

export default function FollowupTable({ leads, page, totalPages, onPageChange, onViewTemplate, onMarkSent, onStartCallback, updatingId }) {
  return (
    <div className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-soft">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-emerald-100">
          <thead className="bg-emerald-50">
            <tr>
              {["Time", "Name", "Phone", "Email", "Service", "Source", "Followup Status", "Action"].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-emerald-800">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-4 text-sm text-gray-600">{formatDateTime(lead.timestamp)}</td>
                <td className="px-4 py-4 font-semibold text-gray-900">{lead.name}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.phone}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.email}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.service}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.source || "Website Form"}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.followup}</td>
                <td className="px-4 py-4">
                  <ActionButtons lead={lead} onViewTemplate={onViewTemplate} onMarkSent={onMarkSent} onStartCallback={onStartCallback} updatingId={updatingId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 p-4 md:hidden">
        {leads.map((lead) => (
          <div key={lead.id} className="rounded-lg border border-emerald-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">{lead.name}</h3>
                <p className="text-sm text-gray-500">{formatDateTime(lead.timestamp)}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{lead.service}</span>
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p>{lead.phone}</p>
              <p>{lead.email}</p>
              <p>Followup: {lead.followup}</p>
              <p>Source: {lead.source || "Website Form"}</p>
            </div>
            <div className="mt-4">
              <ActionButtons lead={lead} onViewTemplate={onViewTemplate} onMarkSent={onMarkSent} onStartCallback={onStartCallback} updatingId={updatingId} />
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

function ActionButtons({ lead, onViewTemplate, onMarkSent, onStartCallback, updatingId }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100" onClick={() => onViewTemplate(lead)}>
        <span className="inline-flex items-center gap-1">
          <Mail size={15} /> Send Email
        </span>
      </button>
      <button
        className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        onClick={() => onMarkSent(lead)}
        disabled={updatingId === lead.id}
      >
        <span className="inline-flex items-center gap-1">
          <Mail size={15} /> Mark Sent
        </span>
      </button>
      <button
        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
        onClick={() => onStartCallback(lead)}
        disabled={updatingId === lead.id || !lead.phone}
      >
        <span className="inline-flex items-center gap-1">
          <PhoneCall size={15} /> AI Callback
        </span>
      </button>
    </div>
  );
}
