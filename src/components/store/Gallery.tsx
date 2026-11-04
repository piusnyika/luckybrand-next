"use client";
import Image from "next/image";
import { useState } from "react";

export function Gallery({ images, name, videoUrl }: { images: { url: string; alt: string }[]; name: string; videoUrl?: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const cur = images[i];
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-base bg-white"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
        onMouseLeave={() => setZoom(null)}>
        {cur ? <Image src={cur.url} alt={cur.alt || name} fill priority sizes="(max-width: 1024px) 100vw, 640px" className="object-contain transition-transform duration-200"
          style={zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
          : <div className="flex h-full items-center justify-center bg-surface text-ink-muted">No image</div>}
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar">
          {images.map((g, k) => (
            <button key={g.url} type="button" onClick={() => setI(k)} aria-label={`Image ${k + 1}`}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-form border-2 bg-white ${k === i ? "border-primary" : "border-line"}`}>
              <Image src={g.url} alt="" fill sizes="80px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
      {videoUrl && /youtu/.test(videoUrl) && (
        <div className="mt-4 aspect-video overflow-hidden rounded-base">
          <iframe src={videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")} title={name} className="h-full w-full" allowFullScreen loading="lazy" />
        </div>
      )}
    </div>
  );
}
