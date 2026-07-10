import { Bot, Check, ClipboardList, Copy, Globe2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const sources = [
  {
    title: "Website Form",
    icon: Globe2,
    status: "Ready",
    buttonLabel: "Manage Website Form",
    description: "Capture inquiries from the public website form."
  },
  {
    title: "Google Form",
    icon: ClipboardList,
    status: "API Ready",
    buttonLabel: "Configure Google Form",
    description: "Connect a clinic's own Google Form with a generated Apps Script."
  },
  {
    title: "AI Voice Agent",
    icon: Bot,
    status: "Webhook Ready",
    buttonLabel: "Configure AI Agent",
    description: "Prepare Retell and Twilio webhook setup for inbound calls."
  },
  {
    title: "AI Chatbot",
    icon: Bot,
    status: "n8n Ready",
    buttonLabel: "Configure Chatbot",
    description: "Use the website chatbot, n8n brain, and CRM context to capture leads."
  }
];

export default function SourcesPage() {
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [googleConfig, setGoogleConfig] = useState({
    crmApiUrl: "https://dental-crm-neg8.onrender.com/api/integrations/google-form",
    integrationKey: "dental_google_form_2026_secret_98765",
    nameField: "Name",
    phoneField: "Phone",
    emailField: "Email",
    serviceField: "Service",
    notesField: "Notes"
  });

  useEffect(() => {
    const savedConfig = localStorage.getItem("dentalLeadGoogleFormConfig");
    if (savedConfig) {
      setGoogleConfig(JSON.parse(savedConfig));
    }
  }, []);

  const googleScript = useMemo(() => {
    return `const CRM_API_URL = "${googleConfig.crmApiUrl}";
const INTEGRATION_KEY = "${googleConfig.integrationKey}";

function onFormSubmit(e) {
  const itemResponses = e.response.getItemResponses();
  const answers = {};

  itemResponses.forEach(function(itemResponse) {
    const title = itemResponse.getItem().getTitle();
    const answer = itemResponse.getResponse();
    answers[title] = Array.isArray(answer) ? answer.join(", ") : answer;
  });

  const payload = {
    name: answers["${googleConfig.nameField}"] || "",
    phone: answers["${googleConfig.phoneField}"] || "",
    email: answers["${googleConfig.emailField}"] || "",
    service: answers["${googleConfig.serviceField}"] || "",
    notes: answers["${googleConfig.notesField}"] || ""
  };

  UrlFetchApp.fetch(CRM_API_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-integration-key": INTEGRATION_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}`;
  }, [googleConfig]);

  function updateGoogleConfig(field, value) {
    setGoogleConfig((current) => ({ ...current, [field]: value }));
  }

  function saveGoogleConfig() {
    localStorage.setItem("dentalLeadGoogleFormConfig", JSON.stringify(googleConfig));
  }

  async function copyScript() {
    await navigator.clipboard.writeText(googleScript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-emerald-700">Unified capture endpoint</p>
        <h3 className="mt-1 text-xl font-bold text-gray-900">Lead capture sources</h3>
        <p className="mt-2 text-sm text-gray-500">
          Website Form, Google Form, Retell AI Voice Agent, and AI Chatbot can all create leads through the CRM backend.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-4">
        {sources.map((source) => {
          const Icon = source.icon;
          return (
            <section key={source.title} className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{source.title}</h3>
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{source.status}</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600">{source.description}</p>
              <button
                className="mt-5 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:from-emerald-700 hover:to-green-600"
                onClick={() => {
                  if (source.title === "Google Form") setGoogleModalOpen(true);
                }}
              >
                {source.buttonLabel}
              </button>
            </section>
          );
        })}
      </div>

      {googleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-soft">
            <div className="flex items-start justify-between border-b border-emerald-100 p-5">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Google Form Integration</p>
                <h3 className="text-xl font-bold text-gray-900">Setup credentials and script</h3>
              </div>
              <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={() => setGoogleModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <Field label="CRM API URL">
                  <input className="form-input" value={googleConfig.crmApiUrl} onChange={(event) => updateGoogleConfig("crmApiUrl", event.target.value)} />
                </Field>
                <Field label="Integration Key">
                  <input className="form-input" value={googleConfig.integrationKey} onChange={(event) => updateGoogleConfig("integrationKey", event.target.value)} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name Field">
                    <input className="form-input" value={googleConfig.nameField} onChange={(event) => updateGoogleConfig("nameField", event.target.value)} />
                  </Field>
                  <Field label="Phone Field">
                    <input className="form-input" value={googleConfig.phoneField} onChange={(event) => updateGoogleConfig("phoneField", event.target.value)} />
                  </Field>
                  <Field label="Email Field">
                    <input className="form-input" value={googleConfig.emailField} onChange={(event) => updateGoogleConfig("emailField", event.target.value)} />
                  </Field>
                  <Field label="Service Field">
                    <input className="form-input" value={googleConfig.serviceField} onChange={(event) => updateGoogleConfig("serviceField", event.target.value)} />
                  </Field>
                </div>
                <Field label="Notes Field">
                  <input className="form-input" value={googleConfig.notesField} onChange={(event) => updateGoogleConfig("notesField", event.target.value)} />
                </Field>

                <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Setup steps</p>
                  <p className="mt-1">Paste this script into Apps Script, save it, then create an On form submit trigger for onFormSubmit.</p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-bold text-gray-900">Generated Apps Script</h4>
                  <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" onClick={copyScript}>
                    <span className="inline-flex items-center gap-2">
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copied" : "Copy"}
                    </span>
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-emerald-50">
                  {googleScript}
                </pre>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-emerald-100 p-5 sm:flex-row sm:justify-end">
              <button className="rounded-lg border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50" onClick={saveGoogleConfig}>
                Save Settings
              </button>
              <button className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800" onClick={() => setGoogleModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}
