"use client";
import { useActionState } from "react";
import { login } from "@/app/(store)/my-account/actions";
export function AdminLoginForm() {
  const [st, act, pending] = useActionState(login, undefined);
  return (
    <form action={act} className="space-y-4">
      {st?.error && <p className="rounded-form bg-red-50 px-3 py-2 text-sm text-danger">{st.error}</p>}
      <input type="hidden" name="next" value="/admin/" /><input type="hidden" name="remember" value="on" />
      <label className="block"><span className="label">Email or username</span><input name="username" required className="field" autoComplete="username" /></label>
      <label className="block"><span className="label">Password</span><input name="password" type="password" required className="field" autoComplete="current-password" /></label>
      <button disabled={pending} className="btn-primary w-full">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
