import { useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export function Profile() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [msg, setMsg] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.put("/v1/users/me", { full_name: fullName, phone });
      await refreshUser();
      setMsg("Profile updated.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Update failed");
    }
  };

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl font-bold text-ink">Profile details</h2>
      <form onSubmit={save} className="mt-5 max-w-md space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input bg-stone-50" value={user?.email ?? ""} disabled />
        </div>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="btn-primary px-6 py-2.5">Save changes</button>
        {msg && <p className="text-sm font-medium text-accent-600">{msg}</p>}
      </form>
    </div>
  );
}
