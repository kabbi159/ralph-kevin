import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PersonaBench",
  description: "Data-grounded persona UX testing",
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
          background: "#0a0a0a",
          color: "#e5e5e5",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
