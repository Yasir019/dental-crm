import { Mail, PhoneCall } from "lucide-react";
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
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft xl:col-span-2">
        <h3 className="text-lg font-bold text-gray-900">Lead Follow-up Automation</h3>
        <p className="mt-1 text-sm text-gray-500">Choose which actions run automatically after a new lead provides name, email, phone, and service.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <AutomationToggle
            icon={Mail}
            title="Automatic AI Email"
            description="n8n creates a personalized email and sends it through the configured email provider."
            checked={automation.automaticEmailEnabled}
            configured={automation.emailConfigured && automation.workflowConfigured}
            disabled={automationLoading || automationSaving || !automation.emailConfigured || !automation.workflowConfigured}
            onChange={(checked) => handleAutomationChange("automaticEmailEnabled", checked)}
          />
          <AutomationToggle
            icon={PhoneCall}
            title="Automatic AI Callback"
            description="Retell AI calls the lead using their captured phone number and service context."
            checked={automation.automaticCallbackEnabled}
            configured={automation.callbackConfigured && automation.workflowConfigured}
            disabled={automationLoading || automationSaving || !automation.callbackConfigured || !automation.workflowConfigured}
            onChange={(checked) => handleAutomationChange("automaticCallbackEnabled", checked)}
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-emerald-50 pt-5">
          <p className="text-sm text-gray-500">Changes save automatically. Staff can still send either action manually from each lead page.</p>
          <span className={`shrink-0 text-sm font-semibold ${automationSaving ? "text-amber-600" : "text-emerald-700"}`}>
            {automationSaving ? "Saving..." : "Saved automatically"}
          </span>
        </div>
      </section>
      <form className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft" onSubmit={handleProfileSubmit}>
        <h3 className="text-lg font-bold text-gray-900">Profile Settings</h3>
        <p className="mt-1 text-sm text-gray-500">Update clinic and staff profile details.</p>
        <div className="mt-5 grid gap-4">
          <Field label="Display Name">
            <input className="form-input" value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} />
          </Field>
          <Field label="Clinic Name">
            <input className="form-input" value={profile.clinicName} onChange={(event) => setProfile((current) => ({ ...current, clinicName: event.target.value }))} />
          </Field>
          <Field label="Email">
            <input className="form-input" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} />
          </Field>
          <Field label="Phone">
            <input className="form-input" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
        </div>
        <button className="mt-5 rounded-lg bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={profileLoading}>
          {profileLoading ? "Saving..." : "Save Profile"}
        </button>
      </form>

      <form className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft" onSubmit={handlePasswordSubmit}>
        <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
        <p className="mt-1 text-sm text-gray-500">Update the CRM login password.</p>
        <div className="mt-5 grid gap-4">
          <Field label="Current Password">
            <input className="form-input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} />
          </Field>
          <Field label="New Password">
            <input className="form-input" type="password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} />
          </Field>
        </div>
        <button className="mt-5 rounded-lg bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={passwordLoading}>
          {passwordLoading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

function AutomationToggle({ icon: Icon, title, description, checked, configured, disabled, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-emerald-100 p-4 hover:bg-emerald-50/50">
      <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-bold text-gray-900">{title}<span className={`rounded-full px-2 py-0.5 text-xs ${configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{configured ? "Ready" : "Not configured"}</span></span>
        <span className="mt-1 block text-sm leading-6 text-gray-500">{description}</span>
      </span>
      <span className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-emerald-600" : "bg-gray-200"}`}>
        <input className="sr-only" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
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
