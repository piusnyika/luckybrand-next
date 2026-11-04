"use client";
import { useState } from "react";
export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  return (
    <form className="flex w-full flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
      e.preventDefault(); setState("busy");
      const email = new FormData(e.currentTarget).get("email");
      const r = await fetch("/api/newsletter/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json().catch(() => ({})); setMsg(j.message || ""); setState(r.ok ? "done" : "error");
    }}>
      {state === "done" ? <p className="text-sm font-semibold">{msg || "Thanks for subscribing!"}</p> : <>
        <input name="email" type="email" required placeholder="Your email address" aria-label="Email address" className="h-12 flex-1 rounded-form border-0 px-4 text-ink outline-none" />
        <button disabled={state === "busy"} className="h-12 rounded-form bg-accent px-6 text-sm font-semibold text-ink hover:brightness-95">{state === "busy" ? "..." : "Subscribe"}</button>
        {state === "error" && <p className="text-sm">{msg || "Something went wrong."}</p>}
      </>}
    </form>
  );
}
