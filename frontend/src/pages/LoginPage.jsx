import { Lock, LogIn, Stethoscope } from "lucide-react";
import { useState } from "react";
import { authService } from "../services/authService";

export default function LoginPage({ onLogin, onBack, showToast }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await authService.login(form);
      localStorage.setItem("dentalLeadAuthToken", result.token);
      onLogin(result.user);
      showToast({ title: "Welcome back", message: "CRM access granted." });
    } catch (error) {
      showToast({ type: "error", title: "Login failed", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-emerald-50 to-green-100 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-emerald-100 bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Stethoscope size={24} />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">DentalLead CRM</p>
            <h1 className="text-2xl font-bold text-gray-950">Staff Login</h1>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-700">Username</span>
            <input className="form-input" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="Dental" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-700">Password</span>
            <input className="form-input" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Dental@2026" />
          </label>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-3 font-bold text-white shadow hover:from-emerald-700 hover:to-green-600 disabled:opacity-60" disabled={loading}>
            {loading ? <Lock size={18} /> : <LogIn size={18} />}
            {loading ? "Signing in..." : "Login to CRM"}
          </button>
        </form>

        <button className="mt-4 w-full rounded-lg border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50" onClick={onBack}>
          Back to Website
        </button>
      </section>
    </main>
  );
}
