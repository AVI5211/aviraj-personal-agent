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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">Aviraj Personal Admin</span>
        <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              pathname === item.href ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
