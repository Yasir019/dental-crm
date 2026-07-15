import { Plus, X } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import FiltersBar from "../components/FiltersBar";
import LeadForm from "../components/LeadForm";
import LeadsTable from "../components/LeadsTable";
import VoiceCallModal from "../components/VoiceCallModal";
import { leadsService } from "../services/leadsService";

const PAGE_SIZE = 5;

const initialFilters = {
  search: "",
  startDate: "",
  endDate: "",
  service: "",
  status: ""
};

const sourceCopy = {
  "Website Form": {
    title: "Website Form Leads",
    description: "Inquiries submitted from the public dental website form."
  },
  "Google Form": {
    title: "Google Form Leads",
    description: "Patients captured from connected Google Forms."
  },
  "AI Chatbot": {
    title: "AI Chatbot Leads",
    description: "Leads qualified through the website AI chatbot."
  },
  "AI Voice Agent": {
    title: "AI Voice Leads",
    description: "Inbound callers captured by the Retell AI voice agent."
  }
};

export default function LeadsPage({ leads, setLeads, showToast, onViewLead, sourceFilter = "", title, description }) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [voiceLead, setVoiceLead] = useState(null);
  const pageTitle = title || sourceCopy[sourceFilter]?.title || "Lead pipeline";
  const pageDescription = description || sourceCopy[sourceFilter]?.description || "Add a walk-in, phone, or manually collected dental inquiry.";

  const filteredLeads = useMemo(() => {
    const search = filters.search.toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = [lead.name, lead.phone, lead.email, lead.service, lead.source || "", lead.notes || ""].some((value) => value.toLowerCase().includes(search));
      const leadDate = lead.timestamp ? new Date(lead.timestamp) : null;
      const afterStart = !filters.startDate || (leadDate && leadDate >= new Date(`${filters.startDate}T00:00:00`));
      const beforeEnd = !filters.endDate || (leadDate && leadDate <= new Date(`${filters.endDate}T23:59:59`));
      const matchesService = !filters.service || lead.service === filters.service;
      const matchesStatus = !filters.status || lead.status === filters.status;
      const matchesSource = !sourceFilter || lead.source === sourceFilter;
      return matchesSearch && afterStart && beforeEnd && matchesService && matchesStatus && matchesSource;
    });
  }, [filters, leads, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const visibleLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      await leadsService.updateStatus(id, status);
      setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
      showToast({ title: "Status updated", message: `Lead marked as ${status}.` });
    } catch (error) {
      showToast({ type: "error", title: "Update failed", message: error.message });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCreateLead(payload) {
    setCreating(true);
    try {
      const result = await leadsService.createLead({
        ...payload,
        source: "Manual Entry",
        sourceDetail: "Created by CRM admin"
      });
      setLeads((current) => [result.lead, ...current]);
      setNewLeadOpen(false);
      setPage(1);
      showToast({ title: "Lead created", message: "Manual lead added successfully." });
    } catch (error) {
      showToast({ type: "error", title: "Create failed", message: error.message });
      throw error;
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateLead(payload) {
    if (!editingLead) return;
    setSavingEdit(true);
    try {
      const result = await leadsService.updateLead(editingLead.id, payload);
      setLeads((current) => current.map((lead) => (lead.id === editingLead.id ? result.lead : lead)));
      setEditingLead(null);
      showToast({ title: "Lead updated", message: "Lead details saved successfully." });
    } catch (error) {
      showToast({ type: "error", title: "Update failed", message: error.message });
      throw error;
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleArchiveLead(lead) {
    setArchivingId(lead.id);
    try {
      await leadsService.archiveLead(lead.id);
      setLeads((current) => current.filter((item) => item.id !== lead.id));
      setArchiveTarget(null);
      showToast({ title: "Lead archived", message: `${lead.name} was moved out of the active pipeline.` });
    } catch (error) {
      showToast({ type: "error", title: "Archive failed", message: error.message });
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-100 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{pageTitle}</h3>
          <p className="text-sm text-gray-500">{pageDescription}</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:from-emerald-700 hover:to-green-600"
          onClick={() => setNewLeadOpen(true)}
        >
          <Plus size={18} />
          New Lead
        </button>
      </div>
      <FiltersBar
        filters={filters}
        setFilters={(updater) => {
          setPage(1);
          setFilters(updater);
        }}
      />
      {filteredLeads.length === 0 ? (
        <EmptyState title="No matching leads" message="Try adjusting the filters or search term." />
      ) : (
        <LeadsTable
          leads={visibleLeads}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onStatusChange={handleStatusChange}
          onView={onViewLead}
          onEdit={setEditingLead}
          onArchive={setArchiveTarget}
          updatingId={updatingId}
          archivingId={archivingId}
          onVoiceDetails={setVoiceLead}
          showSourceColumn={!sourceFilter}
        />
      )}

      {newLeadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-soft">
            <div className="flex items-start justify-between border-b border-emerald-100 p-5">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Manual Entry</p>
                <h3 className="text-xl font-bold text-gray-900">Add New Lead</h3>
              </div>
              <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={() => setNewLeadOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <LeadForm
                onSubmit={handleCreateLead}
                loading={creating}
                submitLabel="Create Lead"
                initialValues={{
                  source: "Manual Entry",
                  sourceDetail: "Created by CRM admin"
                }}
              />
            </div>
          </div>
        </div>
      )}

      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-soft">
            <div className="flex items-start justify-between border-b border-emerald-100 p-5">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Edit Lead</p>
                <h3 className="text-xl font-bold text-gray-900">{editingLead.name}</h3>
              </div>
              <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={() => setEditingLead(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <LeadForm
                key={editingLead.id}
                onSubmit={handleUpdateLead}
                loading={savingEdit}
                submitLabel="Save Changes"
                initialValues={{
                  name: editingLead.name,
                  phone: editingLead.phone,
                  email: editingLead.email,
                  service: editingLead.service,
                  notes: editingLead.notes || "",
                  source: editingLead.source || "Manual Entry",
                  sourceDetail: editingLead.sourceDetail || ""
                }}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title="Archive lead?"
        message={
          archiveTarget
            ? `${archiveTarget.name} will move to the Archive page. You can restore or permanently delete it later.`
            : ""
        }
        confirmLabel="Archive Lead"
        cancelLabel="Cancel"
        loading={Boolean(archivingId)}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => handleArchiveLead(archiveTarget)}
      />

      {voiceLead && <VoiceCallModal lead={voiceLead} onClose={() => setVoiceLead(null)} showToast={showToast} />}
    </div>
  );
}
