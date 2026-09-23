import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aviraj Money Desk",
  description: "Your private personal finance dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 antialiased">{children}</body>
    </html>
  );
}
