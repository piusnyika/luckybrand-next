"use client";
import { useActionState, useState } from "react";
import { submitReview } from "@/app/(store)/product/[slug]/actions";
import { Stars } from "./Stars";

type Review = { id: number; name: string; rating: number; title: string; body: string; verified: boolean; createdAt: string };

export function Reviews({ productId, reviews, count, avg, dist, user }: {
  productId: number; reviews: Review[]; count: number; avg: number; dist: number[]; user: { name: string } | null;
}) {
  const [st, act, pending] = useActionState(submitReview, undefined);
  const [rating, setRating] = useState(0); const [hover, setHover] = useState(0);
  return (
    <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
      <div>
        {count > 0 ? (<>
          <div className="flex items-center gap-3"><span className="text-4xl font-bold">{avg.toFixed(1)}</span><div><Stars value={avg} size={20} /><p className="text-sm text-ink-muted">{count} review{count === 1 ? "" : "s"}</p></div></div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {[5, 4, 3, 2, 1].map((s) => (
              <li key={s} className="flex items-center gap-2"><span className="w-10 text-ink-soft">{s} star</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-full bg-amber-500" style={{ width: `${(dist[s - 1] / count) * 100}%` }} /></span>
                <span className="w-6 text-right text-ink-muted">{dist[s - 1]}</span></li>
            ))}
          </ul>
        </>) : <p className="text-sm text-ink-soft">No reviews yet. Be the first to review this product.</p>}

        <form action={act} className="mt-8 space-y-3 rounded-base border border-line p-5">
          <h3 className="font-semibold">Write a review</h3>
          {st?.ok ? <p className="rounded-form bg-green-50 px-3 py-2 text-sm text-green-800">{st.ok}</p> : (<>
            {st?.error && <p className="rounded-form bg-red-50 px-3 py-2 text-sm text-danger">{st.error}</p>}
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="rating" value={rating || ""} />
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            <div role="radiogroup" aria-label="Your rating" className="flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`}
                  onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} className="p-0.5">
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill={(hover || rating) >= i ? "#f59e0b" : "#d9dce0"} /></svg>
                </button>
              ))}
            </div>
            {!user && (<>
              <label className="block"><span className="label">Name</span><input name="name" required maxLength={120} className="field" autoComplete="name" /></label>
              <label className="block"><span className="label">Email <span className="font-normal text-ink-muted">(not shown)</span></span><input name="email" type="email" required className="field" autoComplete="email" /></label>
            </>)}
            {user && <p className="text-sm text-ink-soft">Reviewing as <strong>{user.name}</strong></p>}
            <label className="block"><span className="label">Title <span className="font-normal text-ink-muted">(optional)</span></span><input name="title" maxLength={191} className="field" /></label>
            <label className="block"><span className="label">Your review</span><textarea name="body" required minLength={10} maxLength={3000} rows={4} className="field h-auto py-2" /></label>
            <button disabled={pending || !rating} className="btn-primary w-full">{pending ? "Sending…" : "Submit review"}</button>
            {!rating && <p className="text-center text-xs text-ink-muted">Choose a star rating first</p>}
          </>)}
        </form>
      </div>

      <div>
        {reviews.length > 0 && <ul className="divide-y divide-line">
          {reviews.map((r) => (
            <li key={r.id} className="py-5 first:pt-0">
              <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} />{r.title && <strong className="text-[15px]">{r.title}</strong>}</div>
              <p className="mt-1 text-xs text-ink-muted">{r.name} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                {r.verified && <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 font-semibold text-success">Verified purchase</span>}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{r.body}</p>
            </li>
          ))}
        </ul>}
      </div>
    </div>
  );
}
