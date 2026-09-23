import { NavBar } from "@/components/NavBar";
import { BiometricAppLock } from "@/components/BiometricAppLock";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <BiometricAppLock />
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
