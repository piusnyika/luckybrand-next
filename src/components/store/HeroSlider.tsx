"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../Icon";

export function HeroSlider({ slides, interval = 5000 }: { slides: { image: string; link: string; alt: string }[]; interval?: number }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  useEffect(() => { if (n < 2) return; const t = setInterval(() => setI((x) => (x + 1) % n), interval); return () => clearInterval(t); }, [n, interval]);
  if (!n) return null;
  return (
    <div className="group relative aspect-[936/440] w-full overflow-hidden rounded-base bg-surface">
      {slides.map((s, k) => {
        const img = <Image src={s.image} alt={s.alt || "Lucky Brand promotion"} fill priority={k === 0} sizes="(max-width: 1024px) 100vw, 980px" className="object-cover" />;
        return (
          <div key={k} className={`absolute inset-0 transition-opacity duration-700 ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={k !== i}>
            {s.link ? <Link href={s.link} className="block h-full w-full">{img}</Link> : img}
          </div>
        );
      })}
      {n > 1 && (<>
        <button type="button" aria-label="Previous slide" onClick={() => setI((i - 1 + n) % n)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition group-hover:opacity-100"><Icon name="chevronLeft" /></button>
        <button type="button" aria-label="Next slide" onClick={() => setI((i + 1) % n)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition group-hover:opacity-100"><Icon name="chevronRight" /></button>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/20 px-2 py-1.5">
          {slides.map((_, k) => <button key={k} type="button" aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-2 rounded-full transition-all ${k === i ? "w-5 bg-white" : "w-2 bg-white/60"}`} />)}
        </div>
      </>)}
    </div>
  );
}
