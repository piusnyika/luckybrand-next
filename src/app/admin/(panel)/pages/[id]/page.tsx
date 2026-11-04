import { requireStaff } from "@/lib/auth";
import { notFound } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { PageHeader, Card, Field, SubmitButton, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { RichText } from "@/components/admin/RichText";
import { savePage, deletePage } from "../actions";
export const metadata = { title: "Edit page" };
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const { id } = await params; const p = id === "new" ? null : await db.query.pages.findFirst({ where: eq(s.pages.id, Number(id)) });
  if (id !== "new" && !p) notFound();
  return (
    <>
      <FlashToast />
      <PageHeader back="/admin/pages/" title={p ? p.title : "Add page"} actions={p && <a href={`/${p.slug}/`} target="_blank" className="btn-outline h-10 text-sm">View page</a>} />
      <form action={savePage} className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <input type="hidden" name="id" value={p?.id ?? ""} />
        <Card><div className="space-y-4">
          <Field label="Title"><input name="title" required defaultValue={p?.title} className="field text-lg" /></Field>
          <div><span className="label">Content</span><RichText name="content" defaultValue={p?.content} minHeight={420} /></div>
        </div></Card>
        <div className="space-y-6">
          <Card title="Publish"><div className="space-y-4">
            <Field label="Status"><select name="published" defaultValue={p?.published === false ? "0" : "1"} className="field"><option value="1">Published</option><option value="0">Draft</option></select></Field>
            <Field label="URL slug"><input name="slug" defaultValue={p?.slug} className="field" /></Field>
            <div className="flex items-center justify-between">{p ? <ConfirmButton formAction={deletePage} message="Delete this page?">Delete</ConfirmButton> : <span />}<SubmitButton>Save</SubmitButton></div>
          </div></Card>
          <Card title="SEO"><div className="space-y-4">
            <Field label="SEO title"><input name="seoTitle" defaultValue={p?.seoTitle} className="field" /></Field>
            <Field label="Meta description"><textarea name="seoDescription" rows={3} defaultValue={p?.seoDescription ?? ""} className="field" /></Field>
          </div></Card>
        </div>
      </form>
    </>
  );
}
