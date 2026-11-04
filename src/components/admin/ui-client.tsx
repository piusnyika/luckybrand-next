"use client";
import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function SubmitButton({ children, className = "btn-primary", pendingText = "Saving…", name, value, formAction }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string; formAction?: (fd: FormData) => void }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className} name={name} value={value} formAction={formAction}>{pending ? pendingText : children}</button>;
}
export function ConfirmButton({ children, message = "Are you sure?", className = "text-sm font-medium text-danger hover:underline", formAction }: { children: React.ReactNode; message?: string; className?: string; formAction?: (fd: FormData) => void }) {
  return <button type="submit" formAction={formAction} className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</button>;
}
/** Shows ?msg=… as a toast, then cleans the URL */
export function FlashToast() {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const m = sp.get("msg"); if (!m) return;
    setMsg(m); const u = new URLSearchParams(sp.toString()); u.delete("msg");
    router.replace(path + (u.toString() ? "?" + u : ""), { scroll: false });
    const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t);
  }, [sp, router, path]);
  if (!msg) return null;
  const err = msg.startsWith("Error");
  return <div className={`fixed bottom-6 right-6 z-[90] rounded-form px-4 py-3 text-sm font-medium text-white shadow-lg ${err ? "bg-danger" : "bg-ink"}`}>{msg}</div>;
}
