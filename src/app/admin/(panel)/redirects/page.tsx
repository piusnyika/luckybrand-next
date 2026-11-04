import { requireAdmin } from "@/lib/auth";
import { PageHeader, Card, Table, th, td, Empty, SubmitButton, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { saveRedirect, deleteRedirect } from "./actions";
import { prisma } from "@/lib/prisma";
export const metadata = { title: "Redirects" };
export default async function Redirects() {
  await requireAdmin();
  const rows = await prisma.redirect.findMany({ orderBy: { id: "desc" } });
  return (<>
    <FlashToast />
    <PageHeader title="Redirects" subtitle="Send old or changed URLs to their new location (keeps Google rankings). Changes apply within a minute." />
    <Card className="mb-6"><form action={saveRedirect} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
      <label><span className="label">Old path</span><input name="from" required placeholder="/old-product-name/" className="field" /></label>
      <label><span className="label">New path or URL</span><input name="to" required placeholder="/product/new-name/" className="field" /></label>
      <label><span className="label">Type</span><select name="code" className="field"><option value="301">301 permanent</option><option value="302">302 temporary</option></select></label>
      <SubmitButton>Add</SubmitButton>
    </form></Card>
    {rows.length === 0 ? <Empty>No redirects yet.</Empty> : <Table head={<><th className={th}>From</th><th className={th}>To</th><th className={th}>Type</th><th className={th}>Hits</th><th className={th} /></>}>
      {rows.map((r) => <tr key={r.id}><td className={`${td} font-mono text-xs`}>{r.from}</td><td className={`${td} font-mono text-xs`}>{r.to}</td><td className={td}>{r.code}</td><td className={td}>{r.hits}</td>
        <td className={`${td} text-right`}><form action={deleteRedirect}><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Delete redirect?" className="text-xs text-danger">Delete</ConfirmButton></form></td></tr>)}
    </Table>}
  </>);
}
