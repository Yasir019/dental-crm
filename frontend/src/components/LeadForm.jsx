import { Send } from "lucide-react";
import { useState } from "react";
import { SERVICES } from "../utils/constants";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  service: "",
  source: "Website Form",
  sourceDetail: "Public website inquiry form",
  notes: ""
};

const defaultPlaceholders = {
  name: "Patient name",
  phone: "+1 555 123 4567",
  email: "patient@email.com",
  notes: "Extra details, preferred time, or staff notes"
};

export default function LeadForm({ onSubmit, loading, submitLabel = "Submit Inquiry", initialValues = initialForm, notesLabel = "Notes", placeholders = defaultPlaceholders }) {
  const [form, setForm] = useState({ ...initialForm, ...initialValues });
  const [errors, setErrors] = useState({});

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email.";
    if (!form.service) nextErrors.service = "Please select a service.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit(form);
    setForm({ ...initialForm, ...initialValues });
    setErrors({});
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-emerald-100 bg-white p-6 shadow-soft">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <input className="form-input" value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder={placeholders.name} />
        </Field>
        <Field label="Phone Number" error={errors.phone}>
          <input className="form-input" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder={placeholders.phone} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="form-input" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder={placeholders.email} />
        </Field>
        <Field label="Service" error={errors.service}>
          <select className="form-input" value={form.service} onChange={(event) => updateField("service", event.target.value)}>
            <option value="">Select a dental service</option>
            {SERVICES.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-5">
        <Field label={notesLabel}>
          <textarea
            className="form-input min-h-24"
            value={form.notes || ""}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder={placeholders.notes}
          />
        </Field>
      </div>
      <button
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-5 py-3 font-semibold text-white shadow transition hover:from-emerald-700 hover:to-green-600 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
        disabled={loading}
      >
        <Send size={18} />
        {loading ? "Submitting..." : submitLabel}
      </button>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}
