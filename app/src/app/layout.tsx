import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: "Aviraj Money Desk",
  description: "Your private personal finance dashboard",
  applicationName: "Aviraj Money Desk",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Money Desk",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
