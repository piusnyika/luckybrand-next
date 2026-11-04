import Link from "next/link";
import { Icon } from "../Icon";
export { SubmitButton, ConfirmButton, FlashToast } from "./ui-client";

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && <Link href={back} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-primary"><Icon name="chevronLeft" size={14} />Back</Link>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function Card({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-base border border-line bg-white ${className}`}>
      {title && <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="text-[15px] font-semibold">{title}</h2>{actions}</div>}
      <div className="p-5">{children}</div>
    </section>
  );
}
export function Badge({ children, className = "bg-gray-100 text-gray-700" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}
export function Empty({ children }: { children: React.ReactNode }) { return <div className="rounded-base border border-dashed border-line bg-white p-10 text-center text-sm text-ink-soft">{children}</div>; }
export const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-soft";
export const td = "px-4 py-3 align-middle";
export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-base border border-line bg-white">
      <table className="w-full text-sm"><thead className="border-b border-line bg-surface"><tr>{head}</tr></thead><tbody className="divide-y divide-line">{children}</tbody></table>
    </div>
  );
}
export function Field({ label, hint, children, className = "" }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}</label>;
}
export function SearchBar({ q, placeholder = "Search…", children }: { q?: string; placeholder?: string; children?: React.ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap gap-2">
      <input name="q" defaultValue={q} placeholder={placeholder} className="field h-10 max-w-xs text-sm" />
      {children}
      <button className="btn-outline h-10 text-sm">Filter</button>
    </form>
  );
}
