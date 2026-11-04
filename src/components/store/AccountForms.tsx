"use client";
import { useActionState } from "react";
import Link from "next/link";
import { GoogleButton } from "./GoogleButton";
import { login, register, saveAddress, saveAccount, requestReset, resetPassword, type FormState } from "@/app/(store)/my-account/actions";

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return s.error ? <p className="mb-4 rounded-form bg-red-50 px-4 py-3 text-sm text-danger">{s.error}</p> : s.ok ? <p className="mb-4 rounded-form bg-green-50 px-4 py-3 text-sm text-green-800">{s.ok}</p> : null;
}
const Field = (p: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; auto?: string; className?: string }) => (
  <label className={`block ${p.className ?? ""}`}><span className="label">{p.label}{p.required && <span className="text-danger"> *</span>}</span>
    <input className="field" name={p.name} type={p.type ?? "text"} required={p.required} defaultValue={p.defaultValue} autoComplete={p.auto} /></label>
);

export function LoginRegister({ next, google, googleError }: { next: string; google?: boolean; googleError?: string }) {
  const [ls, la, lp] = useActionState(login, undefined);
  const [rs, ra, rp] = useActionState(register, undefined);
  return (<>
    {google && (
      <div className="mx-auto max-w-sm pt-6">
        {googleError && <p className="mb-4 rounded-form bg-red-50 px-4 py-3 text-sm text-danger">{googleError}</p>}
        <GoogleButton next={next} />
        <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted"><span className="h-px flex-1 bg-line" />or use your email<span className="h-px flex-1 bg-line" /></div>
      </div>
    )}
    <div className="mx-auto grid max-w-4xl gap-10 py-6 md:grid-cols-2">
      <form action={la} className="rounded-base border border-line p-6 sm:p-8">
        <h2 className="mb-5 text-xl font-semibold">Login</h2><Msg s={ls} />
        <input type="hidden" name="next" value={next} />
        <div className="space-y-4">
          <Field label="Username or email address" name="username" required auto="username" />
          <Field label="Password" name="password" type="password" required auto="current-password" />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="remember" defaultChecked className="accent-primary" /> Remember me</label>
            <Link href="/my-account/lost-password/" className="text-primary">Lost your password?</Link>
          </div>
          <button disabled={lp} className="btn-primary w-full">{lp ? "Logging in…" : "Log in"}</button>
        </div>
      </form>
      <form action={ra} className="rounded-base border border-line p-6 sm:p-8">
        <h2 className="mb-5 text-xl font-semibold">Register</h2><Msg s={rs} />
        <input type="hidden" name="next" value={next} />
        <div className="space-y-4">
          <Field label="Email address" name="email" type="email" required auto="email" />
          <Field label="Password" name="password" type="password" required auto="new-password" />
          <p className="text-xs text-ink-muted">Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our <Link href="/privacy-policy/" className="text-primary">privacy policy</Link>.</p>
          <button disabled={rp} className="btn-primary w-full">{rp ? "Creating account…" : "Register"}</button>
        </div>
      </form>
    </div>
  </>);
}

export function AddressForm({ a }: { a: Record<string, string> }) {
  const [st, act, p] = useActionState(saveAddress, undefined);
  return (
    <form action={act} className="max-w-2xl"><Msg s={st} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" required defaultValue={a.firstName} /><Field label="Last name" name="lastName" required defaultValue={a.lastName} />
        <Field className="sm:col-span-2" label="Company name (optional)" name="company" defaultValue={a.company} />
        <Field className="sm:col-span-2" label="Street address" name="address1" required defaultValue={a.address1} />
        <Field className="sm:col-span-2" label="Apartment, suite, unit (optional)" name="address2" defaultValue={a.address2} />
        <Field label="Town / City" name="city" required defaultValue={a.city} /><Field label="Province" name="state" defaultValue={a.state} />
        <Field label="Phone" name="phone" type="tel" required defaultValue={a.phone} /><Field label="Email address" name="email" type="email" defaultValue={a.email} />
        <input type="hidden" name="postcode" defaultValue={a.postcode} />
      </div>
      <button disabled={p} className="btn-primary mt-6">Save address</button>
    </form>
  );
}

export function AccountForm({ u }: { u: { firstName: string; lastName: string; displayName: string; email: string } }) {
  const [st, act, p] = useActionState(saveAccount, undefined);
  return (
    <form action={act} className="max-w-2xl"><Msg s={st} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" required defaultValue={u.firstName} /><Field label="Last name" name="lastName" required defaultValue={u.lastName} />
        <Field className="sm:col-span-2" label="Display name" name="displayName" required defaultValue={u.displayName} />
        <Field className="sm:col-span-2" label="Email address" name="email" type="email" required defaultValue={u.email} />
      </div>
      <fieldset className="mt-8 rounded-base border border-line p-5"><legend className="px-2 font-semibold">Password change</legend>
        <div className="space-y-4">
          <Field label="Current password (leave blank to leave unchanged)" name="currentPassword" type="password" auto="current-password" />
          <Field label="New password (leave blank to leave unchanged)" name="newPassword" type="password" auto="new-password" />
          <Field label="Confirm new password" name="confirmPassword" type="password" auto="new-password" />
        </div>
      </fieldset>
      <button disabled={p} className="btn-primary mt-6">Save changes</button>
    </form>
  );
}

export function LostPasswordForm() {
  const [st, act, p] = useActionState(requestReset, undefined);
  return (
    <form action={act} className="mx-auto max-w-md rounded-base border border-line p-6"><Msg s={st} />
      <p className="mb-4 text-sm text-ink-soft">Lost your password? Please enter your username or email address. You will receive a link to create a new password via email.</p>
      <Field label="Username or email" name="user_login" required />
      <button disabled={p} className="btn-primary mt-5 w-full">Reset password</button>
    </form>
  );
}
export function ResetPasswordForm({ token }: { token: string }) {
  const [st, act, p] = useActionState(resetPassword, undefined);
  return (
    <form action={act} className="mx-auto max-w-md space-y-4 rounded-base border border-line p-6"><Msg s={st} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" required auto="new-password" />
      <Field label="Re-enter new password" name="confirm" type="password" required auto="new-password" />
      <button disabled={p} className="btn-primary w-full">Save</button>
    </form>
  );
}
