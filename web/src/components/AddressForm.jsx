import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

export const emptyAddress = {
  line1: "",
  line2: "",
  locality: "",
  city: "",
  state: "",
  pincode: "",
};

export function addressIsComplete(value, lookup) {
  return (
    value.line1.trim() !== "" &&
    value.locality.trim() !== "" &&
    value.city.trim() !== "" &&
    value.state.trim() !== "" &&
    value.pincode.length === 6 &&
    lookup?.pincode === value.pincode
  );
}

export function AddressForm({ value, onChange, idPrefix = "addr" }) {
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const pin = value.pincode?.replace(/\D/g, "") ?? "";
    if (pin.length !== 6) {
      setLookup(null);
      setError("");
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.get(`/v1/pincode/${pin}`);
        if (cancelled) return;
        setLookup(data);
        const locality = data.localities.includes(value.locality)
          ? value.locality
          : data.localities[0] ?? "";
        if (value.city !== data.city || value.state !== data.state || value.locality !== locality) {
          onChange({ ...value, pincode: pin, city: data.city, state: data.state, locality });
        }
      } catch (e) {
        if (cancelled) return;
        setLookup(null);
        onChange({ ...value, pincode: pin, city: "", state: "", locality: "" });
        setError(e instanceof ApiError ? e.message : "Could not verify pincode.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value.pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPincode = (raw) => {
    const pin = raw.replace(/\D/g, "").slice(0, 6);
    onChange({ ...value, pincode: pin, city: "", state: "", locality: "" });
    setLookup(null);
    setError("");
  };

  const verified = addressIsComplete(value, lookup);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor={`${idPrefix}-pincode`}>Pincode</label>
        <input
          id={`${idPrefix}-pincode`}
          className="input"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="6-digit pincode"
          value={value.pincode}
          onChange={(e) => setPincode(e.target.value)}
        />
        {loading && <p className="mt-1.5 text-xs text-stone-400">Looking up pincode…</p>}
        {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
        {verified && !loading && (
          <p className="mt-1.5 text-xs font-medium text-accent-600">Pincode verified</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-locality`}>Area / locality</label>
        <select
          id={`${idPrefix}-locality`}
          className="input"
          required
          disabled={!lookup?.localities?.length}
          value={value.locality}
          onChange={(e) => onChange({ ...value, locality: e.target.value })}
        >
          <option value="">
            {lookup?.localities?.length ? "Select locality" : "Enter pincode first"}
          </option>
          {lookup?.localities?.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-city`}>City</label>
        <input
          id={`${idPrefix}-city`}
          className="input bg-stone-50"
          required
          readOnly
          tabIndex={-1}
          value={value.city}
        />
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-state`}>State</label>
        <input
          id={`${idPrefix}-state`}
          className="input bg-stone-50"
          required
          readOnly
          tabIndex={-1}
          value={value.state}
        />
      </div>

      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${idPrefix}-line1`}>Address line 1</label>
        <input
          id={`${idPrefix}-line1`}
          className="input"
          required
          autoComplete="address-line1"
          placeholder="House no., building, street"
          value={value.line1}
          onChange={(e) => onChange({ ...value, line1: e.target.value })}
        />
      </div>

      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${idPrefix}-line2`}>Address line 2 (optional)</label>
        <input
          id={`${idPrefix}-line2`}
          className="input"
          autoComplete="address-line2"
          placeholder="Apartment, landmark, etc."
          value={value.line2}
          onChange={(e) => onChange({ ...value, line2: e.target.value })}
        />
      </div>
    </div>
  );
}
