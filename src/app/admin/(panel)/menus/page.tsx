import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { categoryUrlMap, getAllCategories } from "@/lib/catalog";
import { PageHeader, FlashToast } from "@/components/admin/ui";
import { MenuEditor } from "@/components/admin/MenuEditor";
import { saveMenu } from "./actions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Menus" };
const LABELS: Record<string, string> = { main: "Main menu (header)", categories: "Browse Categories (header dropdown)", "top-right": "Top right links", "mobile-bottom": "Mobile menu extras" };
export default async function Menus({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams;
  const menus = (await prisma.menuItem.findMany({ distinct: ["menu"], select: { menu: true }, orderBy: { menu: "asc" } })).map((m) => m.menu);
  for (const k of ["main", "categories", "footer-quick-links", "footer-email-address", "footer-get-to-know-us"]) if (!menus.includes(k)) menus.push(k);
  const menu = sp.menu && /^[a-z0-9-]+$/.test(sp.menu) ? sp.menu : "main";
  if (!menus.includes(menu)) menus.push(menu);
  const [rows, cats, urls, pages] = await Promise.all([
    prisma.menuItem.findMany({ where: { menu }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
    getAllCategories(), categoryUrlMap(), prisma.page.findMany({ select: { title: true, slug: true }, orderBy: { title: "asc" } }),
  ]);
  // order rows depth-first so children follow their parent
  const ordered: typeof rows = []; const add = (pid: number | null) => rows.filter((r) => (r.parentId ?? null) === pid).forEach((r) => { ordered.push(r); add(r.id); }); add(null);
  for (const r of rows) if (!ordered.includes(r)) ordered.push(r);
  return (
    <>
      <FlashToast />
      <PageHeader title="Menus" subtitle="Footer column titles and which menu they use are set in Settings → Footer." />
      <div className="mb-5 flex flex-wrap gap-2">
        {menus.map((m) => <Link key={m} href={`/admin/menus/?menu=${m}`} className={`rounded-full px-3 py-1.5 text-sm ${m === menu ? "bg-primary text-white" : "bg-white text-ink-soft hover:text-ink"}`}>{LABELS[m] ?? m.replace(/^footer-/, "Footer: ").replace(/-/g, " ")}</Link>)}
        <form className="flex gap-1"><input name="menu" placeholder="new-menu-key" pattern="[a-z0-9-]+" className="field h-9 w-40 text-sm" /><button className="btn-outline h-9 text-sm">+ New</button></form>
      </div>
      <MenuEditor key={menu} action={saveMenu} menu={menu}
        initial={ordered.map((r) => ({ key: String(r.id), label: r.label, url: r.url, parentKey: r.parentId ? String(r.parentId) : null }))}
        sources={{ categories: cats.map((c) => ({ label: c.name, url: urls.get(c.id)! })), pages: [{ label: "Home", url: "/" }, { label: "Shop", url: "/shop/" }, { label: "My account", url: "/my-account/" }, { label: "Wishlist", url: "/wishlist/" }, ...pages.map((p) => ({ label: p.title, url: `/${p.slug}/` }))] }} />
    </>
  );
}
