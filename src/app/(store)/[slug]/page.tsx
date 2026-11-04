import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema as s } from "@/db";
import { and, eq } from "drizzle-orm";
import { stripHtml } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ContactForm } from "@/components/store/ContactForm";
import { Icon } from "@/components/Icon";

const getPage = (slug: string) => db.query.pages.findFirst({ where: and(eq(s.pages.slug, decodeURIComponent(slug)), eq(s.pages.published, true)) });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPage((await params).slug); if (!p) return {};
  return { title: p.seoTitle?.replace(/%%[^%]+%%/g, "").trim() || p.title, description: p.seoDescription || stripHtml(p.content).slice(0, 160), alternates: { canonical: `/${p.slug}/` } };
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getPage((await params).slug);
  if (!p) notFound();
  if (p.slug === "contact") return <Contact />;
  return (
    <>
      <div className="bg-[#f1f2f4] py-12"><div className="container"><h1 className="text-3xl font-semibold lg:text-[40px]">{p.title}</h1></div></div>
      <div className="container max-w-4xl">
        <Breadcrumbs items={[{ label: p.title }]} />
        <article className="prose-lb pb-6 [&_details]:mb-3 [&_details]:rounded-base [&_details]:border [&_details]:border-line [&_details]:px-5 [&_details]:py-4 [&_summary]:cursor-pointer [&_summary]:font-semibold [&_summary]:text-ink [&_details[open]_summary]:mb-3"
          dangerouslySetInnerHTML={{ __html: p.content }} />
      </div>
    </>
  );
}

type ContactSettings = { heading: string; subheading: string; mapQuery: string; blocks: { title: string; html: string }[]; formTitle: string; formIntro: string; social: { icon: string; url: string }[] };
async function Contact() {
  const c = await getSetting<ContactSettings>("contact");
  return (
    <>
      <div className="bg-[#f1f2f4] py-12 lg:py-16"><div className="container"><h1 className="text-3xl font-semibold lg:text-[40px]">{c?.heading ?? "Contact us"}</h1><p className="mt-2 text-[15px]">{c?.subheading}</p></div></div>
      <div className="container grid gap-12 border-t border-line pt-12 lg:mt-14 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">Contact Details</h2>
          {c?.mapQuery && <iframe title="Map" loading="lazy" className="mt-6 h-[320px] w-full rounded-base border-0" src={`https://maps.google.com/maps?q=${encodeURIComponent(c.mapQuery)}&t=m&z=16&output=embed&iwloc=near`} />}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {c?.blocks.map((b) => <div key={b.title}><div className="mb-2 text-sm text-ink-muted">{b.title}</div><div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: b.html }} /></div>)}
          </div>
          <div className="mt-8 flex items-center gap-3 border-t border-line pt-6 text-sm">Follow us on social media:
            {c?.social.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener" aria-label={s.icon} className="flex h-8 w-8 items-center justify-center rounded-full bg-notice text-white hover:opacity-80"><Icon name={s.icon} size={15} /></a>)}
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-semibold">{c?.formTitle ?? "Get in Touch"}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{c?.formIntro}</p>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
