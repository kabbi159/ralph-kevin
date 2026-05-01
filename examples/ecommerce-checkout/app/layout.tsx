import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Demo Shop — Checkout",
  description: "Intentionally-flawed demo checkout for PersonaBench (UX test target).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          margin: 0,
          background: "#fafafa",
          color: "#111",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
