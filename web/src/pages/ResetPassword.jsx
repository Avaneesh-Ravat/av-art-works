import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/v1/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-stone-900">Reset password</h1>
      {done ? (
        <p className="card mt-6 p-6 text-sm text-green-700">Password updated. Redirecting to login…</p>
      ) : (
        <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Reset token</label>
            <input className="input" required value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full py-2.5">Update password</button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-brand-700 hover:underline">Back to login</Link>
          </p>
        </form>
      )}
    </div>
  );
}
