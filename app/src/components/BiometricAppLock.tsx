"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";

export function BiometricAppLock() {
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isEnabled = localStorage.getItem("moneyDeskBiometricLock") === "enabled";
    setEnabled(isEnabled);
    setLocked(isEnabled);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isEnabled) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function unlock() {
    setBusy(true); setError(null);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/login/options", { method: "POST" });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(options.error);
      const credential = await startAuthentication({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/passkey/login/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credential) });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error);
      setLocked(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fingerprint unlock was cancelled"); }
    finally { setBusy(false); }
  }

  if (!enabled || !locked) return null;
  return <div className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-emerald-950/95 px-5 text-center text-white">
    <div className="w-full max-w-sm rounded-2xl border border-emerald-700 bg-emerald-900 p-6 shadow-2xl">
      <p className="text-sm font-semibold text-emerald-200">Aviraj Money Desk is locked</p>
      <h1 className="mt-2 text-2xl font-bold">Unlock with your device</h1>
      <p className="mt-2 text-sm text-emerald-100">Use your Samsung fingerprint, face unlock, or screen-lock PIN.</p>
      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
      <button type="button" onClick={unlock} disabled={busy} className="mt-5 min-h-12 w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-emerald-950 disabled:opacity-60">
        {busy ? "Waiting for device unlock…" : "Unlock with fingerprint"}
      </button>
    </div>
  </div>;
}
