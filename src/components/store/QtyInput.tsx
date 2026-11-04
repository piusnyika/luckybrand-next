"use client";
import { Icon } from "../Icon";
export function QtyInput({ value, onChange, small = false, max }: { value: number; onChange: (v: number) => void; small?: boolean; max?: number | null }) {
  const h = small ? "h-8" : "h-[46px]";
  return (
    <div className={`inline-flex ${h} items-center rounded-form border border-line`}>
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(1, value - 1))} className={`${small ? "w-7" : "w-10"} flex h-full items-center justify-center`}><Icon name="minus" size={small ? 14 : 18} /></button>
      <input type="number" min={1} max={max ?? undefined} value={value} aria-label="Quantity"
        onChange={(e) => { const v = parseInt(e.target.value || "1", 10); onChange(Math.max(1, max ? Math.min(max, v) : v)); }}
        className={`${small ? "w-8 text-sm" : "w-10"} h-full bg-transparent text-center font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
      <button type="button" aria-label="Increase" onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)} className={`${small ? "w-7" : "w-10"} flex h-full items-center justify-center`}><Icon name="plus" size={small ? 14 : 18} /></button>
    </div>
  );
}
