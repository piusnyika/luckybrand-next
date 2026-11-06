import Link from "next/link";
import { activeAnnouncements, getSetting, getSite, salesContactsOf, type SearchSettings } from "@/lib/settings";
import { AnnouncementBar } from "./AnnouncementBar";
import { getMenu, type MenuNode } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { HeaderActions } from "./HeaderActions";
import { CategoryMenu } from "./CategoryMenu";
import { MobileNav } from "./MobileNav";
import { StickyHeader } from "./StickyHeader";
import { SalesContacts, type HeaderContact } from "./SalesContacts";

const phoneKey = (p: string) => p.replace(/\D/g, "").replace(/^0/, "263");

export async function Header() {
  const [site, main, cats, user, search, announce] = await Promise.all([
    getSite(), getMenu("main"), getMenu("categories"), getCurrentUser(), getSetting<SearchSettings>("search"), activeAnnouncements(),
  ]);
  // named sales people get Call + WhatsApp; any other number (e.g. the office landline) gets Call only
  const sales = salesContactsOf(site);
  const contacts: HeaderContact[] = [
    ...sales.map((c) => ({ ...c, whatsapp: true })),
    ...site.phones.filter((p) => !sales.some((c) => phoneKey(c.phone) === phoneKey(p.tel)))
      .map((p) => ({ name: p.label.match(/\(([^)]+)\)/)?.[1].trim() || "Office line", role: "", phone: p.tel, whatsapp: false })),
  ];
  const searchBox = <SearchBox placeholder={search.placeholder || undefined} whatsapp={site.whatsapp || sales[0]?.phone || ""} />;
  return (<>
    <AnnouncementBar items={announce.items} seconds={announce.seconds} dismissible={announce.dismissible} />
    <StickyHeader>
      {/* own layer above the menu row, so the search dropdown, cart preview and Call Us panel open over the categories panel */}
      <div className="relative z-20 border-b border-line bg-white lg:border-0">
        <div className="container flex h-[64px] items-center gap-4 transition-[height] duration-200 lg:h-[100px] lg:gap-8 lg:group-data-[scrolled=true]:h-[68px]">
          <MobileNav main={main} cats={cats} site={{ logo: site.logo, name: site.name, phones: site.phones }} />
          <Link href="/" className="shrink-0" aria-label={site.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logo} alt={site.name} className="h-[34px] w-auto transition-[height] duration-200 lg:h-[41px] lg:group-data-[scrolled=true]:h-[34px]" />
          </Link>
          <div className="hidden flex-1 lg:block">{searchBox}</div>
          <HeaderActions loggedIn={!!user} name={user?.firstName || user?.displayName || ""}
            freeShipping={{ threshold: site.freeShippingThreshold, message: site.freeShippingMessage, success: site.freeShippingSuccess }}>
            <SalesContacts contacts={contacts} hours={site.hours} />
          </HeaderActions>
        </div>
        <div className="container pb-3 group-data-[scrolled=true]:hidden lg:hidden">{searchBox}</div>
      </div>
      <div className="relative z-10 hidden border-b border-[rgba(27,31,34,0.1)] lg:block">
        <div className="container flex h-12 items-center gap-8">
          <CategoryMenu items={cats} />
          <nav className="flex items-center gap-6">
            {main.map((m) => <NavLink key={m.id} m={m} />)}
          </nav>
        </div>
      </div>
    </StickyHeader>
  </>);
}

function NavLink({ m }: { m: MenuNode }) {
  const ext = /^https?:\/\//.test(m.url);
  if (!m.children.length) return <Link href={m.url} target={ext ? "_blank" : undefined} className="px-1.5 text-base font-semibold text-ink hover:text-primary">{m.label}</Link>;
  return (
    <div className="group relative">
      <Link href={m.url} className="px-1.5 text-base font-semibold text-ink hover:text-primary">{m.label}</Link>
      <div className="invisible absolute left-0 top-full z-50 min-w-[220px] rounded-base border border-line bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
        {m.children.map((c) => <Link key={c.id} href={c.url} className="block px-4 py-2 text-sm hover:text-primary">{c.label}</Link>)}
      </div>
    </div>
  );
}
