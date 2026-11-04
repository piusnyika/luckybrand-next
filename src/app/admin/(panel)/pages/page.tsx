import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { PageHeader, Table, th, td, Badge, FlashToast } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
export const metadata = { title: "Pages" };
export default async function Pages() {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const rows = await prisma.page.findMany({ orderBy: { title: "asc" } });
  return (
    <>
      <FlashToast />
      <PageHeader title="Pages" subtitle="Static pages such as policies, FAQ and contact. The Contact page layout is edited under Settings → Contact page." actions={<Link href="/admin/pages/new/" className="btn-primary h-10 text-sm">+ Add page</Link>} />
      <Table head={<><th className={th}>Title</th><th className={th}>URL</th><th className={th}>Status</th><th className={th}>Updated</th></>}>
        {rows.map((p) => <tr key={p.id}><td className={td}><Link href={`/admin/pages/${p.id}/`} className="font-semibold hover:text-primary">{p.title}</Link></td><td className={td}><a href={`/${p.slug}/`} target="_blank" className="text-ink-soft hover:text-primary">/{p.slug}/</a></td><td className={td}>{p.published ? <Badge className="bg-green-100 text-green-800">Published</Badge> : <Badge>Draft</Badge>}</td><td className={`${td} text-ink-soft`}>{formatDate(p.updatedAt)}</td></tr>)}
      </Table>
    </>
  );
}
