"use client";
import { useActionState, useState } from "react";
import { verifyTwoStep } from "@/app/admin/two-step/actions";

export function TwoStepForm() {
  const [st, act, pending] = useActionState(verifyTwoStep, undefined);
  const [recovery, setRecovery] = useState(false);
  return (
    <form action={act} className="space-y-4">
      {st?.error && <p className="rounded-form bg-red-50 px-3 py-2 text-sm text-danger">{st.error}</p>}
      <label className="block">
        <span className="label">{recovery ? "Recovery code" : "Code"}</span>
        <input key={String(recovery)} name="code" required autoFocus className="field text-center text-lg tracking-[0.3em]"
          {...(recovery ? { placeholder: "xxxxx-xxxxx", autoComplete: "off" } : { inputMode: "numeric" as const, pattern: "[0-9 ]{6,7}", maxLength: 7, autoComplete: "one-time-code", placeholder: "123456" })} />
      </label>
      <button disabled={pending} className="btn-primary w-full">{pending ? "Checking…" : "Verify"}</button>
      <button type="button" onClick={() => setRecovery(!recovery)} className="w-full text-center text-sm text-primary">
        {recovery ? "Use a code from the app instead" : "Lost your phone? Use a recovery code"}
      </button>
      <p className="text-center text-xs text-ink-muted"><a href="/admin/login/" className="hover:text-ink">Start again</a></p>
    </form>
  );
}
