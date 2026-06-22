import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";

export function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await register(form.email, form.password, form.full_name, form.phone);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Join AV Art Works to shop and track orders.">
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
        <div>
          <label className="label">Full name</label>
          <input className="input" required value={form.full_name} onChange={update("full_name")} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={update("email")} />
        </div>
        <div>
          <label className="label">Phone (optional)</label>
          <input className="input" value={form.phone} onChange={update("phone")} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required value={form.password} onChange={update("password")} />
          <p className="mt-1.5 text-xs text-stone-400">At least 8 characters.</p>
        </div>
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-stone-500">
          Already have an account? <Link to="/login" className="link-underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
