import { useState } from "react";
import { authService } from "../services/authService";

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

  return (
    <div className="grid gap-6 xl:grid-cols-2">
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}
