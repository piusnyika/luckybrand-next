import Link from "next/link";
import { getSite } from "@/lib/settings";
import { getMenu } from "@/lib/catalog";
import { Icon } from "../Icon";
import { NewsletterForm } from "./NewsletterForm";

export async function Footer() {
  const site = await getSite();
  const cols = await Promise.all((site.footerColumns || []).map(async (c) => ({ ...c, items: await getMenu(c.menu) })));
  return (
    <footer className="mt-16 pb-16 lg:pb-0">
      <section className="bg-primary py-12 text-white">
        <div className="container grid items-center gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tightish lg:text-[28px]">{site.newsletterTitle}</h2>
            <p className="mt-2 text-sm text-white/80" dangerouslySetInnerHTML={{ __html: site.newsletterSubtitle }} />
          </div>
          <NewsletterForm />
        </div>
      </section>
      <section className="bg-surface py-12 lg:py-16">
        <div className="container grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div className="lg:border-r lg:border-line lg:pr-8">
            <h3 className="text-2xl font-semibold">Find Us</h3>
            <p className="mt-4 text-sm">{site.address}</p>
            {site.email && <p className="mt-4 text-sm">Email: <a href={`mailto:${site.email}`} className="font-medium hover:text-primary">{site.email}</a></p>}
            {site.hours.length > 0 && <div className="mt-4 text-sm"><div className="text-ink-soft">Call hours</div>{site.hours.map((h) => <div key={h} className="font-semibold">{h}</div>)}</div>}
          </div>
          {cols.map((c) => (
            <div key={c.menu}>
              <h3 className="text-[15px] font-semibold">{c.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {c.items.map((i) => <li key={i.id}><Link href={i.url} className="text-sm text-ink-soft hover:text-primary">{i.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="container">
          <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span>Follow us:</span>
              {site.social.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener" aria-label={s.icon} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9ecef] text-ink hover:bg-primary hover:text-white"><Icon name={s.icon} size={16} /></a>
              ))}
            </div>
            {site.marketingNote && <p className="text-sm">{site.marketingNote}</p>}
          </div>
        </div>
      </section>
      <div className="bg-white py-6"><div className="container text-xs text-ink-soft">{site.copyright}</div></div>
    </footer>
  );
}
