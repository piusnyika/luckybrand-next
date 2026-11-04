"use client";
import { useActionState } from "react";
import { subscribeStockAlert } from "@/app/(store)/product/[slug]/actions";

export function StockAlertForm({ productId, email }: { productId: number; email: string }) {
  const [st, act, pending] = useActionState(subscribeStockAlert, undefined);
  if (st?.ok) return <p className="mt-4 rounded-form bg-green-50 px-4 py-3 text-sm text-green-800">{st.ok}</p>;
  return (
    <form action={act} className="mt-4 rounded-base border border-line p-4">
      <p className="mb-2 text-sm font-semibold">Email me when it&apos;s back in stock</p>
      {st?.error && <p className="mb-2 text-sm text-danger">{st.error}</p>}
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-wrap gap-2">
        <input name="email" type="email" required defaultValue={email} placeholder="Your email address" autoComplete="email" className="field min-w-0 flex-1" />
        <button disabled={pending} className="btn-primary h-11">{pending ? "Saving…" : "Notify me"}</button>
      </div>
    </form>
  );
}
