import { FileText, Phone, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { leadsService } from "../services/leadsService";
import { formatDateTime } from "../utils/formatters";
import LoadingSpinner from "./LoadingSpinner";

const tabs = ["Overview", "Transcript", "Webhook Data"];

export default function VoiceCallModal({ lead, onClose, showToast }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [voiceCall, setVoiceCall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    leadsService
      .getVoiceCall(lead.id)
      .then((data) => {
        if (!ignore) setVoiceCall(data.voiceCall);
      })
      .catch((error) => {
        if (!ignore) showToast({ type: "error", title: "Could not load call", message: error.message });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [lead.id, showToast]);

  const transcriptLines = (voiceCall?.transcript || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/55 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <Phone size={22} />
              <h3 className="text-xl font-bold">Call Details</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">View voice agent call for {lead.name}</p>
          </div>
          <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-5">
          {loading ? (
            <LoadingSpinner label="Loading voice call" />
          ) : (
            <>
              <div className="grid grid-cols-3 rounded-lg bg-gray-100 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "Overview" && (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Info label="Status" value={voiceCall?.callStatus || "Completed"} />
                    <Info label="Duration" value={voiceCall?.durationSeconds ? `${voiceCall.durationSeconds}s` : "-"} />
                    <Info label="Caller" value={voiceCall?.fromNumber || lead.phone || "-"} />
                    <Info label="Clinic Number" value={voiceCall?.toNumber || "-"} />
                    <Info label="Date & Time" value={formatDateTime(voiceCall?.startedAt || voiceCall?.createdAt || lead.timestamp)} />
                    <Info label="Sentiment" value={voiceCall?.userSentiment || "-"} />
                  </div>

                  <section className="border-t border-gray-100 pt-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                      <FileText size={18} />
                      Summary
                    </div>
                    <p className="leading-7 text-gray-600">{voiceCall?.callSummary || "No call summary saved yet."}</p>
                  </section>

                  <section className="border-t border-gray-100 pt-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                      <Play size={18} />
                      Recording
                    </div>
                    {voiceCall?.recordingUrl ? (
                      <audio className="w-full" controls src={voiceCall.recordingUrl} />
                    ) : (
                      <p className="text-sm text-gray-500">No recording URL saved for this call.</p>
                    )}
                  </section>
                </div>
              )}

              {activeTab === "Transcript" && (
                <div className="mt-5 rounded-lg border border-gray-100 bg-gray-50 p-4">
                  {transcriptLines.length ? (
                    <div className="space-y-3">
                      {transcriptLines.map((line, index) => (
                        <p key={`${line}-${index}`} className="rounded-lg bg-white p-3 text-sm leading-6 text-gray-700 shadow-sm">
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No transcript saved for this call.</p>
                  )}
                </div>
              )}

              {activeTab === "Webhook Data" && (
                <pre className="mt-5 max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 text-xs leading-5 text-emerald-100">
                  {JSON.stringify(voiceCall?.rawPayload || {}, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}
