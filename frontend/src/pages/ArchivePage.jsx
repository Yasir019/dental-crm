import { RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { leadsService } from "../services/leadsService";
import { formatDateTime } from "../utils/formatters";

const PAGE_SIZE = 5;

export default function ArchivePage({ showToast }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [workingId, setWorkingId] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    leadsService
      .getArchivedLeads()
      .then((data) => {
        if (!ignore) setLeads(data.leads || []);
      })
      .catch((error) => {
        if (!ignore) showToast({ type: "error", title: "Could not load archive", message: error.message });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [showToast]);

  const filteredLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.phone, lead.email, lead.service, lead.source || "", lead.notes || ""].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }, [leads, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const visibleLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleRestore() {
    if (!restoreTarget) return;
    setWorkingId(restoreTarget.id);
    try {
      await leadsService.restoreLead(restoreTarget.id);
      setLeads((current) => current.filter((lead) => lead.id !== restoreTarget.id));
      showToast({ title: "Lead restored", message: `${restoreTarget.name} is back in the active lead pipeline.` });
      setRestoreTarget(null);
    } catch (error) {
      showToast({ type: "error", title: "Restore failed", message: error.message });
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setWorkingId(deleteTarget.id);
    try {
      await leadsService.deleteLead(deleteTarget.id);
      setLeads((current) => current.filter((lead) => lead.id !== deleteTarget.id));
      showToast({ title: "Lead deleted", message: `${deleteTarget.name} was permanently deleted.` });
      setDeleteTarget(null);
    } catch (error) {
      showToast({ type: "error", title: "Delete failed", message: error.message });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-100 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Archive</h3>
          <p className="text-sm text-gray-500">Restore old leads or permanently remove records you no longer need.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="form-input pl-10"
            placeholder="Search archived leads"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-emerald-100 bg-white p-8 text-center text-sm font-semibold text-gray-500 shadow-soft">
          Loading archived leads...
        </div>
      ) : filteredLeads.length === 0 ? (
        <EmptyState title="Archive is empty" message="Archived leads will appear here when you move them out of the active pipeline." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-soft">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-emerald-100">
              <thead className="bg-emerald-50">
                <tr>
                  {["Archived", "Name", "Phone", "Email", "Service", "Source", "Actions"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-emerald-800">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {visibleLeads.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-emerald-50/60">
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDateTime(lead.archivedAt || lead.timestamp)}</td>
                    <td className="px-4 py-4 font-semibold text-gray-900">{lead.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.phone}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.email}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.service}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {lead.source || "Website Form"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          onClick={() => setRestoreTarget(lead)}
                          disabled={workingId === lead.id}
                        >
                          <RotateCcw size={16} />
                          Restore
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          onClick={() => setDeleteTarget(lead)}
                          disabled={workingId === lead.id}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 p-4 md:hidden">
            {visibleLeads.map((lead) => (
              <div key={lead.id} className="rounded-lg border border-emerald-100 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{lead.name}</h3>
                    <p className="text-sm text-gray-500">{formatDateTime(lead.archivedAt || lead.timestamp)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{lead.service}</span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p>{lead.phone}</p>
                  <p>{lead.email}</p>
                  <p>Source: {lead.source || "Website Form"}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setRestoreTarget(lead)}
                    disabled={workingId === lead.id}
                  >
                    <RotateCcw size={16} />
                    Restore
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(lead)}
                    disabled={workingId === lead.id}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <ConfirmModal
        open={Boolean(restoreTarget)}
        title="Restore lead?"
        message={restoreTarget ? `${restoreTarget.name} will return to the active Leads page.` : ""}
        confirmLabel="Restore Lead"
        cancelLabel="Cancel"
        loading={Boolean(workingId)}
        onCancel={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Permanently delete lead?"
        message={deleteTarget ? `${deleteTarget.name} will be deleted forever, including saved chat messages for this lead.` : ""}
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        variant="danger"
        loading={Boolean(workingId)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
