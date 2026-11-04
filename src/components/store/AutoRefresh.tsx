"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the (server) page every few seconds while a payment is pending; gives up after a few minutes. */
export function AutoRefresh({ every = 5000, forMs = 3 * 60_000 }: { every?: number; forMs?: number }) {
  const router = useRouter();
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > forMs) { clearInterval(t); setStopped(true); return; }
      router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every, forMs]);
  return stopped
    ? <span className="mt-1 block text-xs">Still waiting. If you&apos;ve approved the payment, use Refresh above.</span>
    : <span className="mt-1 flex items-center gap-2 text-xs"><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />Checking for your payment…</span>;
}
