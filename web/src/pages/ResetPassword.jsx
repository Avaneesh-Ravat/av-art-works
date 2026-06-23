import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await api.post("/v1/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="Choose a new password for your account.">
      {done ? (
        <p className="rounded-xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700">
          Password updated. Redirecting to login…
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
          <div>
            <label className="label">Reset token</label>
            <input className="input" required value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1.5 text-xs text-stone-400">At least 8 characters.</p>
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full py-3">Update password</button>
          <p className="text-center text-sm">
            <Link to="/login" className="link-underline">Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
