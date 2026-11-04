"use client";
import { useState } from "react";
export function ContactForm() {
  const [st, setSt] = useState<"idle" | "busy" | "done" | "error">("idle"); const [msg, setMsg] = useState("");
  if (st === "done") return <p className="mt-8 rounded-base bg-green-50 p-5 text-green-800">Thank you! Your message has been sent. We’ll get back to you shortly.</p>;
  return (
    <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setSt("busy");
      const r = await fetch("/api/contact/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
      const j = await r.json().catch(() => ({})); if (r.ok) setSt("done"); else { setSt("error"); setMsg(j.message || "Something went wrong."); }
    }}>
      <label><span className="label">Your name *</span><input name="name" required className="field" /></label>
      <label><span className="label">Your email *</span><input name="email" type="email" required className="field" /></label>
      <label><span className="label">Phone</span><input name="phone" type="tel" className="field" /></label>
      <label><span className="label">Subject</span><input name="subject" className="field" /></label>
      <label className="sm:col-span-2"><span className="label">Your message *</span><textarea name="message" required rows={6} className="field" /></label>
      <input name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      {st === "error" && <p className="text-sm text-danger sm:col-span-2">{msg}</p>}
      <div className="sm:col-span-2"><button disabled={st === "busy"} className="btn-primary">{st === "busy" ? "Sending…" : "Send message"}</button></div>
    </form>
  );
}
