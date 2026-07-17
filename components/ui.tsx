"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { fmt } from "@/lib/money";

/* Palette : navy #03357E, acier #4079B2, ciel #74A0C9, blanc — issue du logo. */

const TONES = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  late: "bg-red-50 text-red-700 ring-red-200",
  wait: "bg-amber-50 text-amber-700 ring-amber-200",
  muted: "bg-ciel-50 text-acier ring-ciel-100",
} as const;

export function Tag({ tone = "muted", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ring-1 ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const VARIANTS = {
  primary: "bg-navy-900 text-white hover:bg-navy-700 font-medium",
  ghost: "border border-ciel-300 text-navy-900 hover:bg-ciel-50",
  danger: "text-red-600 hover:bg-red-50",
} as const;

export function Btn({
  children, onClick, variant = "ghost", type = "button", className = "", disabled, title,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: keyof typeof VARIANTS;
  type?: "button" | "submit"; className?: string; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export const inputCls =
  "w-full rounded border border-ciel-300 bg-white px-3 py-2 text-sm text-navy-900 placeholder-ciel-300 focus:border-acier focus:outline-none focus:ring-1 focus:ring-acier disabled:bg-ciel-50 disabled:text-acier";

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`${inputCls} ${p.className || ""}`} />
);

export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={inputCls} />
);

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-acier">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ciel-300">{hint}</span>}
    </label>
  );
}

export function Modal({
  title, onClose, children, wide,
}: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4 backdrop-blur-sm sm:p-8">
      <div className={`w-full rounded-lg bg-white shadow-xl ring-1 ring-ciel-100 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-ciel-100 px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-acier hover:bg-ciel-50">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({
  icon: Icon, titre, action,
}: { icon: React.ComponentType<{ size?: number; className?: string }>; titre: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ciel-300 bg-white py-16 text-center">
      <Icon size={28} className="text-ciel-300" />
      <p className="text-sm text-acier">{titre}</p>
      {action}
    </div>
  );
}

/** Les chiffres sont toujours en mono, toujours alignés. C'est un registre. */
export function Money({ cdf, size = "base", tone = "" }: { cdf: number; size?: "sm" | "base" | "xl"; tone?: string }) {
  const cls = { sm: "text-sm", base: "text-base", xl: "text-2xl" }[size];
  return (
    <span className={`font-mono tabular-nums ${cls} ${tone}`}>
      {fmt(cdf)} <span className="text-xs text-acier">FC</span>
    </span>
  );
}
