import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { AuthShell } from "../components/AuthShell";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/v1/auth/forgot-password", { email }).catch(() => {});
    setSent(true);
  };

  return (
    <AuthShell title="Forgot password" subtitle="We’ll help you get back into your account.">
      {sent ? (
        <div className="space-y-3 text-sm text-stone-600">
          <div className="rounded-xl bg-accent-50 px-4 py-3 text-accent-700">
            If an account exists for <strong>{email}</strong>, a reset link has been sent.
          </div>
          <p className="text-stone-500">
            (In this demo the reset token is logged by the user-service; use it on the{" "}
            <Link to="/reset-password" className="link-underline">reset page</Link>.)
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-stone-500">Enter your email and we’ll send a reset link.</p>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn-primary w-full py-3">Send reset link</button>
          <p className="text-center text-sm">
            <Link to="/login" className="link-underline">Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
