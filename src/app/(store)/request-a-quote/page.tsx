import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getCards } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { QuoteForm } from "@/components/store/QuoteForm";

export const metadata: Metadata = { title: "Request a quote", description: "Get a quote for larger orders, projects and installations." };

export default async function RequestQuote({ searchParams }: { searchParams: Promise<{ product?: string; qty?: string }> }) {
  const sp = await searchParams;
  const [user, cards] = await Promise.all([getCurrentUser(), getCards(sp.product ? [Number(sp.product)].filter(Boolean) : [])]);
  const b = user?.billing ?? {};
  return (
    <div className="container">
      <Breadcrumbs items={[{ label: "Request a quote" }]} />
      <h1 className="mb-2 text-2xl font-semibold">Request a quote</h1>
      <p className="mb-6 max-w-2xl text-ink-soft">Buying for a farm, business or project, or need a large quantity? Tell us what you need and our sales team will send you a quote.</p>
      <QuoteForm initialItems={cards.map((c) => ({ productId: c.id, name: c.name, image: c.image, qty: Math.max(1, Number(sp.qty) || 1) }))}
        initial={{ name: `${b.firstName || user?.firstName || ""} ${b.lastName || user?.lastName || ""}`.trim(), email: user?.email ?? "", phone: b.phone || user?.phone || "", company: b.company || "", city: b.city || "" }} />
    </div>
  );
}
