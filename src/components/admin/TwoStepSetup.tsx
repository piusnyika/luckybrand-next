"use client";
import { useActionState } from "react";
import { confirmSetup, disableTwoStep, regenerateCodes, type SecurityState } from "@/app/admin/(panel)/security/actions";

function Msg({ s }: { s: SecurityState }) {
  if (!s) return null;
  return (<>
    {s.error && <p className="mb-4 rounded-form bg-red-50 px-3 py-2 text-sm text-danger">{s.error}</p>}
    {s.ok && <p className="mb-4 rounded-form bg-green-50 px-3 py-2 text-sm text-green-800">{s.ok}</p>}
    {s.codes && <RecoveryCodes codes={s.codes} />}
  </>);
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="mb-5 rounded-form border border-amber-300 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-semibold text-amber-900">Save these recovery codes now. They are shown only once.</p>
      <p className="mb-3 text-sm text-amber-900">If you lose your phone, each code logs you in once instead of an app code. Keep them somewhere safe, away from your phone.</p>
      <ul className="mb-3 grid grid-cols-2 gap-2 font-mono text-sm">{codes.map((c) => <li key={c} className="rounded bg-white px-2 py-1 text-center">{c}</li>)}</ul>
      <button type="button" className="btn-outline h-9 text-sm" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Copy codes</button>
    </div>
  );
}

const codeInput = <input name="code" required inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="field max-w-[180px] text-center tracking-[0.25em]" />;

export function ConfirmSetupForm() {
  const [st, act, pending] = useActionState(confirmSetup, undefined);
  return (
    <form action={act}>
      <Msg s={st} />
      {st?.codes && <button type="button" className="btn-primary" onClick={() => window.location.reload()}>I've saved my codes</button>}
      {!st?.codes && <div className="flex flex-wrap items-end gap-3">
        <label className="block"><span className="label">Code from the app</span>{codeInput}</label>
        <button disabled={pending} className="btn-primary h-11">{pending ? "Checking…" : "Turn on"}</button>
      </div>}
    </form>
  );
}

export function ManageTwoStep() {
  const [ds, dAct, dPending] = useActionState(disableTwoStep, undefined);
  const [rs, rAct, rPending] = useActionState(regenerateCodes, undefined);
  return (
    <div className="space-y-6">
      <form action={rAct}>
        <Msg s={rs} />
        <p className="mb-2 text-sm text-ink-soft">Used up or lost your recovery codes? Make a new set (the old ones stop working).</p>
        <div className="flex flex-wrap items-end gap-3"><label className="block"><span className="label">Current code</span>{codeInput}</label>
          <button disabled={rPending} className="btn-outline h-11">New recovery codes</button></div>
      </form>
      <form action={dAct} className="border-t border-line pt-6">
        <Msg s={ds} />
        <p className="mb-2 text-sm text-ink-soft">Turn off two-step login for your account. Not recommended.</p>
        <div className="flex flex-wrap items-end gap-3"><label className="block"><span className="label">Current code</span>{codeInput}</label>
          <button disabled={dPending} className="h-11 rounded-form border border-danger px-4 text-sm font-semibold text-danger hover:bg-red-50">Turn off</button></div>
      </form>
    </div>
  );
}
