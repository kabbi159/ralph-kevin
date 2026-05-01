"use client";
import type { ReactNode } from "react";

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-3xl border border-white/10 bg-white/[0.04] ${className}`}>
    {children}
  </div>
);

export const CardContent = ({
  children,
  className = "",
}: { children: ReactNode; className?: string }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

export const Button = ({
  children,
  className = "",
  href,
  variant = "primary",
}: {
  children: ReactNode;
  className?: string;
  href?: string;
  variant?: "primary" | "outline";
}) => {
  const base =
    variant === "primary"
      ? "rounded-full bg-cyan-300 px-7 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
      : "rounded-full border border-white/15 bg-white/5 px-7 py-3 font-semibold text-white transition hover:bg-white/10";
  if (href)
    return (
      <a href={href} className={`${base} ${className}`}>
        {children}
      </a>
    );
  return (
    <button type="button" className={`${base} ${className}`}>
      {children}
    </button>
  );
};

export const SeverityBadge = ({
  severity,
}: { severity: "critical" | "high" | "medium" | "low" }) => {
  const colors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-300 border-red-400/30",
    high: "bg-rose-400/15 text-rose-200 border-rose-400/30",
    medium: "bg-amber-400/15 text-amber-200 border-amber-400/30",
    low: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
  };
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${colors[severity]}`}
    >
      {severity}
    </span>
  );
};
