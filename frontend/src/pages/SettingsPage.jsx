import { Check, LockKeyhole, Mail, PhoneCall, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { followupService } from "../services/followupService";

export default function SettingsPage({ user, setUser, showToast }) {
  const [profile, setProfile] = useState({
    displayName: user?.displayName || "",
    clinicName: user?.clinicName || "",
    email: user?.email || "",
    phone: user?.phone || ""
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [automation, setAutomation] = useState({ automaticEmailEnabled: false, automaticCallbackEnabled: false, emailConfigured: false, callbackConfigured: false, workflowConfigured: false });
  const [automationLoading, setAutomationLoading] = useState(true);
  const [automationSaving, setAutomationSaving] = useState(false);

  useEffect(() => {
    followupService
      .getSettings()
      .then((result) => setAutomation(result.settings))
      .catch((error) => showToast({ type: "error", title: "Automation settings failed", message: error.message }))
      .finally(() => setAutomationLoading(false));
  }, []);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileLoading(true);
    try {
      const result = await authService.updateProfile(profile);
      setUser(result.user);
      showToast({ title: "Profile updated", message: "CRM profile settings were saved." });
    } catch (error) {
      showToast({ type: "error", title: "Profile update failed", message: error.message });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordLoading(true);
    try {
      await authService.updatePassword(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      showToast({ title: "Password updated", message: "Use the new password on your next login." });
    } catch (error) {
      showToast({ type: "error", title: "Password update failed", message: error.message });
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleAutomationChange(field, checked) {
    const previous = automation;
    const next = { ...automation, [field]: checked };
    setAutomation(next);
    setAutomationSaving(true);
    try {
      const result = await followupService.updateSettings({
        automaticEmailEnabled: next.automaticEmailEnabled,
        automaticCallbackEnabled: next.automaticCallbackEnabled
      });
      setAutomation(result.settings);
      showToast({ title: "Automation updated", message: "The new follow-up rule is active for future leads." });
    } catch (error) {
      setAutomation(previous);
      showToast({ type: "error", title: "Automation update failed", message: error.message });
    } finally {
      setAutomationSaving(false);
    }
  }

  return (
    <div className="settings-page grid gap-5 xl:grid-cols-2">
      <div className="settings-automation-section xl:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-4 px-1">
          <h3 className="text-base font-bold text-gray-900">Automation</h3>
          <span className="text-xs font-semibold text-gray-400">{automationSaving ? "Saving..." : "Saved"}</span>
        </div>
        <section className="settings-automation-grid">
          <div className="grid w-full items-stretch gap-5 md:grid-cols-2">
          <AutomationToggle
            icon={Mail}
            title="AI Email"
            description="Sends personalized emails automatically."
            checked={automation.automaticEmailEnabled}
            configured={automation.emailConfigured && automation.workflowConfigured}
            disabled={automationLoading || automationSaving || !automation.emailConfigured || !automation.workflowConfigured}
            onChange={(checked) => handleAutomationChange("automaticEmailEnabled", checked)}
          />
          <AutomationToggle
            icon={PhoneCall}
            title="AI Callback"
            description="Calls leads using their number and context."
            checked={automation.automaticCallbackEnabled}
            configured={automation.callbackConfigured && automation.workflowConfigured}
            disabled={automationLoading || automationSaving || !automation.callbackConfigured || !automation.workflowConfigured}
            onChange={(checked) => handleAutomationChange("automaticCallbackEnabled", checked)}
          />
          </div>
        </section>
      </div>
      <form className="settings-card rounded-2xl border border-emerald-100 bg-white p-5 shadow-soft md:p-6" onSubmit={handleProfileSubmit}>
        <SettingsCardHeader icon={UserRound} title="Profile" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Display Name">
            <input className="form-input" value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} />
          </Field>
          <Field label="Clinic Name" wide>
            <input className="form-input" value={profile.clinicName} onChange={(event) => setProfile((current) => ({ ...current, clinicName: event.target.value }))} />
          </Field>
          <Field label="Email">
            <input className="form-input" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} />
          </Field>
          <Field label="Phone">
            <input className="form-input" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
        </div>
        <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={profileLoading}>
          <Check size={16} />
          {profileLoading ? "Saving..." : "Save Profile"}
        </button>
      </form>

      <form className="settings-card rounded-2xl border border-emerald-100 bg-white p-5 shadow-soft md:p-6" onSubmit={handlePasswordSubmit}>
        <SettingsCardHeader icon={LockKeyhole} title="Security" />
        <div className="mt-6 grid gap-4">
          <Field label="Current Password">
            <input className="form-input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} />
          </Field>
          <Field label="New Password">
            <input className="form-input" type="password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} />
          </Field>
        </div>
        <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={passwordLoading}>
          <Check size={16} />
          {passwordLoading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

function SettingsCardHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Icon size={18} /></span>
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
    </div>
  );
}

function AutomationToggle({ icon: Icon, title, description, checked, configured, disabled, onChange }) {
  return (
    <label className="settings-automation flex cursor-pointer items-center gap-4 rounded-2xl border border-emerald-100 p-5 hover:bg-emerald-50/50">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shadow-sm"><Icon size={27} strokeWidth={1.8} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900">{title}<span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><span className="mr-1">•</span>{configured ? "Active" : "Setup required"}</span></span>
        <span className="mt-1 block text-xs text-gray-500">{description}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-emerald-600" : "bg-gray-200"}`}>
        <input className="sr-only" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

function Field({ label, children, wide = false }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-2 block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}
