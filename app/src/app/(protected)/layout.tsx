import { NavBar } from "@/components/NavBar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
