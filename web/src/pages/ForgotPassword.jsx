import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/v1/auth/forgot-password", { email }).catch(() => {});
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-stone-900">Forgot password</h1>
      {sent ? (
        <div className="card mt-6 p-6 text-sm text-stone-600">
          <p>If an account exists for <strong>{email}</strong>, a reset link has been sent.</p>
          <p className="mt-3 text-stone-500">
            (In this demo the reset token is logged by the user-service; use it on the{" "}
            <Link to="/reset-password" className="text-brand-700 hover:underline">reset page</Link>.)
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
          <p className="text-sm text-stone-500">Enter your email and we’ll send a reset link.</p>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn-primary w-full py-2.5">Send reset link</button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-brand-700 hover:underline">Back to login</Link>
          </p>
        </form>
      )}
    </div>
  );
}
