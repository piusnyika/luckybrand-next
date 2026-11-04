import Link from "next/link";
import { requireStaff } from "@/lib/admin/guard";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, Empty, FlashToast, SubmitButton, ConfirmButton } from "@/components/admin/ui";
import { Stars } from "@/components/store/Stars";
import { moderateReview } from "./actions";

export const metadata = { title: "Reviews" };
const TABS = [["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"]] as const;

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const status = TABS.some(([k]) => k === sp.status) ? sp.status! : "pending";
  const [rows, counts] = await Promise.all([
    prisma.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 200, include: { product: { select: { name: true, slug: true } } } }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const back = `/admin/reviews/?status=${status}`;
  return (<>
    <FlashToast />
    <PageHeader title="Reviews" subtitle="New reviews wait here until you approve them. Approved reviews show on the product page and in Google." />
    <div className="mb-5 flex flex-wrap gap-2">
      {TABS.map(([k, label]) => <Link key={k} href={`/admin/reviews/?status=${k}`} className={`rounded-full px-3 py-1.5 text-sm ${status === k ? "bg-primary text-white" : "bg-white text-ink-soft hover:text-ink"}`}>{label} <span className="opacity-70">({n(k)})</span></Link>)}
    </div>
    {rows.length === 0 ? <Empty>No {TABS.find(([k]) => k === status)![1].toLowerCase()} reviews.</Empty> : (
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-base border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} />{r.title && <strong>{r.title}</strong>}
                {r.verified && <Badge className="bg-green-50 text-success">Verified purchase</Badge>}</div>
              <span className="text-xs text-ink-muted">{formatDate(r.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
            <p className="mt-2 text-xs text-ink-muted">{r.name} · {r.email} · on <a href={`/product/${r.product.slug}/#reviews`} target="_blank" className="text-primary hover:underline">{r.product.name}</a></p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {/* one form per button: React doesn't send a button's name/value with a function formAction */}
              {r.status !== "approved" && <form>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="to" value="approved" />
                <SubmitButton formAction={moderateReview} className="btn-primary h-9 text-sm" pendingText="…">Approve</SubmitButton>
              </form>}
              {r.status !== "rejected" && <form>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="to" value="rejected" />
                <SubmitButton formAction={moderateReview} className="btn-outline h-9 text-sm" pendingText="…">{r.status === "approved" ? "Hide" : "Reject"}</SubmitButton>
              </form>}
              <span className="flex-1" />
              <form>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="to" value="delete" />
                <ConfirmButton formAction={moderateReview} message="Delete this review permanently?">Delete</ConfirmButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    )}
  </>);
}
