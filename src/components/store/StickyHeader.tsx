"use client";
import { createContext, useContext, useEffect, useState } from "react";

const Scrolled = createContext(false);
/** true once the page has scrolled and the sticky header is in its compact state */
export const useHeaderScrolled = () => useContext(Scrolled);

/** Sticks to the top; sets data-scrolled so children can go compact (group-data-[scrolled=true]:…). */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // two thresholds so the header's own height change can't make it flip back and forth
    const onScroll = () => setScrolled((s) => (s ? window.scrollY > 20 : window.scrollY > 140));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <Scrolled.Provider value={scrolled}>
      <header data-scrolled={scrolled} className={`group sticky top-0 z-40 bg-white transition-shadow ${scrolled ? "shadow-[0_4px_20px_rgba(0,0,0,.08)]" : ""}`}>
        {children}
      </header>
    </Scrolled.Provider>
  );
}
