"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5 text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white shadow-sm">AM</span>
          <span><span className="block text-sm font-bold tracking-tight">Aviraj Money Desk</span><span className="block text-[11px] text-slate-500">Personal finance, in one view</span></span>
        </Link>
        <button onClick={handleLogout} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          Sign out
        </button>
      </div>
      <nav aria-label="Primary navigation" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
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
