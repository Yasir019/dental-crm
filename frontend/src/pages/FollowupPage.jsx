import { useEffect, useMemo, useState } from "react";
import AiTemplateModal from "../components/AiTemplateModal";
import ConfirmModal from "../components/ConfirmModal";
import EmptyState from "../components/EmptyState";
import FollowupTable from "../components/FollowupTable";
import { aiService } from "../services/aiService";
import { followupService } from "../services/followupService";
import { leadsService } from "../services/leadsService";

const PAGE_SIZE = 5;

export default function FollowupPage({ leads, setLeads, showToast }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [callbackLead, setCallbackLead] = useState(null);
  const [calling, setCalling] = useState(false);
  const [page, setPage] = useState(1);

  const pendingLeads = useMemo(() => leads.filter((lead) => lead.followup === "Pending"), [leads]);
  const totalPages = Math.max(1, Math.ceil(pendingLeads.length / PAGE_SIZE));
  const visibleLeads = pendingLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleViewTemplate(lead) {
    setSelectedLead(lead);
    setTemplate(null);
    setLoadingTemplate(true);
    try {
      const result = await aiService.generateTemplate({ name: lead.name, service: lead.service });
      setTemplate(result);
    } catch (error) {
      showToast({ type: "error", title: "Template failed", message: error.message });
    } finally {
      setLoadingTemplate(false);
    }
  }

  async function markEmailSent(lead) {
    setUpdatingId(lead.id);
    try {
      await leadsService.updateFollowup(lead.id, "Email Sent");
      setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, followup: "Email Sent" } : item)));
      showToast({ title: "Follow-up updated", message: "Lead marked as Email Sent." });
    } catch (error) {
      showToast({ type: "error", title: "Update failed", message: error.message });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSendEmail() {
    if (!selectedLead || !template) return;
    const confirmed = window.confirm(`Send this follow-up email to ${selectedLead.email}?`);
    if (!confirmed) return;

    setSending(true);
    try {
      const result = await followupService.sendEmail(selectedLead.id, {
        subject: template.subject,
        body: template.body,
      });
      setLeads((current) => current.map((item) => (item.id === selectedLead.id ? { ...item, ...(result.lead || {}), followup: "Email Sent" } : item)));
      showToast({ title: "Email sent", message: `Follow-up sent to ${selectedLead.email}.` });
      setSelectedLead(null);
    } catch (error) {
      showToast({ type: "error", title: "Email failed", message: error.message });
    } finally {
      setSending(false);
    }
  }

  async function startCallback() {
    if (!callbackLead) return;
    setCalling(true);
    try {
      const result = await followupService.startCallback(callbackLead.id);
      setLeads((current) => current.map((item) => (item.id === callbackLead.id ? { ...item, ...(result.lead || {}), followup: "Callback Started" } : item)));
      showToast({ title: "Callback started", message: `AI agent is calling ${callbackLead.phone}.` });
      setCallbackLead(null);
    } catch (error) {
      showToast({ type: "error", title: "Callback failed", message: error.message });
    } finally {
      setCalling(false);
    }
  }

  function handleCopy() {
    if (!template) return;
    navigator.clipboard.writeText(`${template.subject}\n\n${template.body}`);
    showToast({ title: "Copied", message: "Template copied to clipboard." });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold text-gray-900">Pending follow-ups</h3>
        <p className="mt-1 text-sm text-gray-500">Generate friendly email templates, send messages, or mark a lead as contacted.</p>
      </div>
      {pendingLeads.length === 0 ? (
        <EmptyState title="No pending follow-ups" message="Leads with Pending follow-up status will appear here." />
      ) : (
        <FollowupTable
          leads={visibleLeads}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onViewTemplate={handleViewTemplate}
          onMarkSent={markEmailSent}
          onStartCallback={setCallbackLead}
          updatingId={updatingId}
        />
      )}
      <AiTemplateModal
        lead={selectedLead}
        template={template}
        loading={loadingTemplate}
        sending={sending}
        onClose={() => setSelectedLead(null)}
        onCopy={handleCopy}
        onSend={handleSendEmail}
      />
      <ConfirmModal
        open={Boolean(callbackLead)}
        title="Start AI callback?"
        message={callbackLead ? `Retell AI will call ${callbackLead.name} at ${callbackLead.phone} now.` : ""}
        confirmLabel="Start Callback"
        cancelLabel="Cancel"
        loading={calling}
        onCancel={() => setCallbackLead(null)}
        onConfirm={startCallback}
      />
    </div>
  );
}
