import { ArrowLeft, Bot, Mail, Mic, PhoneCall, Send } from "lucide-react";
import { useEffect, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import LoadingSpinner from "../components/LoadingSpinner";
import VoiceCallModal from "../components/VoiceCallModal";
import { aiService } from "../services/aiService";
import { followupService } from "../services/followupService";
import { leadsService } from "../services/leadsService";
import { formatDateTime } from "../utils/formatters";

export default function LeadDetailPage({ leadId, cachedLead, onBack, onLeadUpdated, showToast }) {
  const [lead, setLead] = useState(cachedLead || null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(!cachedLead);
  const [composeOpen, setComposeOpen] = useState(false);
  const [email, setEmail] = useState({ subject: "", body: "" });
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  async function loadActivities() {
    const result = await followupService.getActivities(leadId);
    setActivities(result.activities || []);
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([leadsService.getLead(leadId), followupService.getActivities(leadId)])
      .then(([leadResult, activityResult]) => {
        if (ignore) return;
        setLead(leadResult.lead);
        setActivities(activityResult.activities || []);
      })
      .catch((error) => {
        if (!ignore) showToast({ type: "error", title: "Could not load lead", message: error.message });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [leadId]);

  async function openEmailComposer() {
    setComposeOpen(true);
    if (email.subject || !lead) return;
    setGenerating(true);
    try {
      const template = await aiService.generateTemplate({ name: lead.name, service: lead.service });
      setEmail({ subject: template.subject || "", body: template.body || "" });
    } catch (error) {
      showToast({ type: "error", title: "Template failed", message: error.message });
    } finally {
      setGenerating(false);
    }
  }

  async function sendEmail(event) {
    event.preventDefault();
    setSending(true);
    try {
      const result = await followupService.sendEmail(lead.id, email);
      setLead(result.lead);
      onLeadUpdated(result.lead);
      setComposeOpen(false);
      await loadActivities();
      showToast({ title: "Email sent", message: `Follow-up email sent to ${lead.email}.` });
    } catch (error) {
      showToast({ type: "error", title: "Email failed", message: error.message });
    } finally {
      setSending(false);
    }
  }

  async function startCallback() {
    setCalling(true);
    try {
      const result = await followupService.startCallback(lead.id);
      setLead(result.lead);
      onLeadUpdated(result.lead);
      setCallbackOpen(false);
      await loadActivities();
      showToast({ title: "Callback started", message: `AI agent is calling ${lead.phone}.` });
    } catch (error) {
      showToast({ type: "error", title: "Callback failed", message: error.message });
    } finally {
      setCalling(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading lead details" />;
  if (!lead) return <div className="rounded-lg border border-red-100 bg-white p-5 text-red-700">Lead could not be found.</div>;

  return (
    <div className="space-y-5">
      <button className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800" onClick={onBack}>
        <ArrowLeft size={17} /> Back to leads
      </button>

      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-bold text-gray-900">{lead.name}</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{lead.status}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">Added {formatDateTime(lead.timestamp)} from {lead.source}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700" onClick={openEmailComposer}>
              <Mail size={17} /> Email Customer
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => setCallbackOpen(true)}>
              <PhoneCall size={17} /> AI Callback
            </button>
            {lead.source === "AI Voice Agent" && (
              <button className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50" onClick={() => setVoiceOpen(true)}>
                <Mic size={17} /> Original Call
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-emerald-50 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Email" value={lead.email} />
          <Info label="Phone" value={lead.phone} />
          <Info label="Service" value={lead.service} />
          <Info label="Follow-up" value={lead.followup} />
        </div>
        {lead.notes && <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-600"><span className="font-semibold text-gray-800">Notes: </span>{lead.notes}</div>}
      </section>

      {composeOpen && (
        <form className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft" onSubmit={sendEmail}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Manual email</p>
              <h3 className="text-lg font-bold text-gray-900">Compose follow-up</h3>
            </div>
            <button type="button" className="text-sm font-semibold text-gray-500 hover:text-gray-700" onClick={() => setComposeOpen(false)}>Close</button>
          </div>
          {generating ? (
            <div className="py-8"><LoadingSpinner label="Generating AI email draft" /></div>
          ) : (
            <div className="mt-5 grid gap-4">
              <label>
                <span className="mb-2 block text-sm font-semibold text-gray-700">Subject</span>
                <input className="form-input" required value={email.subject} onChange={(event) => setEmail((current) => ({ ...current, subject: event.target.value }))} />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-gray-700">Message</span>
                <textarea className="form-input min-h-48 resize-y" required value={email.body} onChange={(event) => setEmail((current) => ({ ...current, body: event.target.value }))} />
              </label>
              <div className="flex justify-end">
                <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={sending}>
                  <Send size={17} /> {sending ? "Sending..." : "Send Email"}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold text-gray-900">Follow-up activity</h3>
        <p className="mt-1 text-sm text-gray-500">Automatic and manual contact attempts for this lead.</p>
        {activities.length === 0 ? (
          <p className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No email or callback activity yet.</p>
        ) : (
          <div className="mt-5 divide-y divide-emerald-50">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <div className={`mt-0.5 rounded-lg p-2 ${activity.channel === "email" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                  {activity.channel === "email" ? <Mail size={17} /> : <Bot size={17} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold capitalize text-gray-900">{activity.mode} {activity.channel}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(activity.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-sm capitalize text-gray-600">Status: {activity.status}</p>
                  {activity.subject && <p className="mt-1 truncate text-sm text-gray-500">{activity.subject}</p>}
                  {activity.errorMessage && <p className="mt-1 text-sm text-red-600">{activity.errorMessage}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={callbackOpen}
        title="Start AI callback?"
        message={`Retell AI will call ${lead.name} at ${lead.phone} now.`}
        confirmLabel="Start Callback"
        cancelLabel="Cancel"
        loading={calling}
        onCancel={() => setCallbackOpen(false)}
        onConfirm={startCallback}
      />
      {voiceOpen && <VoiceCallModal lead={lead} onClose={() => setVoiceOpen(false)} showToast={showToast} />}
    </div>
  );
}

function Info({ label, value }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-gray-800">{value || "-"}</p></div>;
}
