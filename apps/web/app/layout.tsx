import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PersonaBench",
  description: "Don't guess. Interview persona agents.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="bg-slate-950">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
