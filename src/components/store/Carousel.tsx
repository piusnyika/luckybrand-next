"use client";
import { useRef } from "react";
import { Icon } from "../Icon";
export function Carousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (d: number) => { const el = ref.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: "smooth" }); };
  return (
    <div className="group relative">
      <div ref={ref} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-base border border-line">
        {children}
      </div>
      <button type="button" aria-label="Previous" onClick={() => go(-1)} className="absolute -left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white shadow opacity-0 transition group-hover:opacity-100 lg:flex"><Icon name="chevronLeft" /></button>
      <button type="button" aria-label="Next" onClick={() => go(1)} className="absolute -right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white shadow opacity-0 transition group-hover:opacity-100 lg:flex"><Icon name="chevronRight" /></button>
    </div>
  );
}
