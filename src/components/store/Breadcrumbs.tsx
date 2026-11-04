import Link from "next/link";
import { Icon } from "../Icon";
import { jsonLd } from "@/lib/format";
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const all = [{ label: "Home", href: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 py-4 text-xs">
      {all.map((b, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <Icon name="chevronRight" size={12} />}
          {b.href && i < all.length - 1 ? <Link href={b.href} className="hover:text-primary">{b.label}</Link> : <span className="text-ink-muted">{b.label}</span>}
        </span>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: all.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.label, item: b.href ? (process.env.SITE_URL || "") + b.href : undefined })),
      }) }} />
    </nav>
  );
}
