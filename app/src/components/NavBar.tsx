"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/salary", label: "Salary" },
  { href: "/shop", label: "Shop" },
  { href: "/personal", label: "Personal" },
  { href: "/investments", label: "Investments" },
  { href: "/loans", label: "Loans" },
  { href: "/freelance", label: "Freelance" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleEnableFingerprint() {
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register/options", { method: "POST" });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(options.error);
      const credential = await startRegistration({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/passkey/register/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credential) });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error);
      window.alert("Fingerprint unlock is enabled on this device.");
    } catch (error) { window.alert(error instanceof Error ? error.message : "Fingerprint setup was cancelled."); }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5 text-slate-900">
          <Image
            src="/aviraj-avatar.png"
            alt="Aviraj"
            width={40}
            height={40}
            priority
            className="h-9 w-9 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-slate-200"
          />
          <span><span className="block text-sm font-bold tracking-tight">Aviraj Money Desk</span><span className="block text-[11px] text-slate-500">Personal finance, in one view</span></span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={handleEnableFingerprint} className="rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">Enable fingerprint</button>
          <button onClick={handleLogout} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">Sign out</button>
        </div>
      </div>
      <nav aria-label="Primary navigation" className="mx-auto grid max-w-5xl grid-cols-4 gap-1 px-4 pb-2 sm:flex sm:px-6">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-2 py-2 text-center text-xs font-semibold sm:whitespace-nowrap sm:rounded-full sm:px-3 sm:py-1.5 sm:text-sm ${
              pathname === item.href ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
