import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { getCategoryTree, getAllCategories, categoryUrlMap, type Category } from "@/lib/catalog";
import { PageHeader, Card, Field, SubmitButton, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/MediaPicker";
import { RichText } from "@/components/admin/RichText";
import { saveCategory, deleteCategory } from "./actions";

export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";
export default async function Categories({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const { edit } = await searchParams;
  const [tree, all, urls] = await Promise.all([getCategoryTree(), getAllCategories(), categoryUrlMap()]);
  const c = edit ? all.find((x) => x.id === Number(edit)) : null;
  const flat: (Category & { depth: number })[] = [];
  const walk = (n: Category[], d: number) => n.forEach((x) => { flat.push({ ...x, depth: d }); walk(x.children ?? [], d + 1); });
  walk(tree, 0);
  return (
    <>
      <FlashToast />
      <PageHeader title="Categories" subtitle={`${all.length} categories`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded-base border border-line bg-white">
          {flat.map((x) => (
            <div key={x.id} className={`flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0 ${c?.id === x.id ? "bg-primary-50" : "hover:bg-surface/60"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {x.image ? <img src={x.image} alt="" className="h-8 w-8 rounded object-contain" /> : <span className="h-8 w-8" />}
              <span className="flex-1" style={{ paddingLeft: x.depth * 20 }}>{x.depth > 0 && <span className="mr-1 text-ink-muted">└</span>}<Link href={`/admin/categories/?edit=${x.id}`} className="font-medium hover:text-primary">{x.name}</Link><span className="ml-2 text-xs text-ink-muted">{x.slug}</span></span>
              <Link href={`/admin/products/?cat=${x.id}`} className="w-16 text-right text-xs text-ink-soft hover:text-primary">{x.count} items</Link>
              <a href={urls.get(x.id)} target="_blank" className="text-xs text-ink-muted hover:text-primary">View</a>
            </div>
          ))}
        </div>
        <Card title={c ? `Edit “${c.name}”` : "Add category"} actions={c && <Link href="/admin/categories/" className="text-xs text-primary">+ New</Link>}>
          <form action={saveCategory} className="space-y-4" key={c?.id ?? "new"}>
            <input type="hidden" name="id" value={c?.id ?? ""} />
            <Field label="Name"><input name="name" required defaultValue={c?.name} className="field" /></Field>
            <Field label="Slug" hint="Used in the URL. Leave blank to generate."><input name="slug" defaultValue={c?.slug} className="field" /></Field>
            <Field label="Parent category"><select name="parentId" defaultValue={c?.parentId ?? ""} className="field"><option value="">None (top level)</option>{flat.filter((x) => x.id !== c?.id).map((x) => <option key={x.id} value={x.id}>{"— ".repeat(x.depth)}{x.name}</option>)}</select></Field>
            <Field label="Sort order"><input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="field" /></Field>
            <ImageField name="image" defaultValue={c?.image} label="Thumbnail" />
            <div><span className="label">Description (shown above products)</span><RichText name="description" defaultValue={c?.description} minHeight={100} /></div>
            <Field label="SEO title"><input name="seoTitle" defaultValue={c?.seoTitle} className="field" /></Field>
            <Field label="Meta description"><textarea name="seoDescription" rows={2} defaultValue={c?.seoDescription ?? ""} className="field" /></Field>
            <div className="flex items-center justify-between">
              {c ? <ConfirmButton formAction={deleteCategory} message="Delete this category? Products stay, sub-categories move up one level.">Delete</ConfirmButton> : <span />}
              <SubmitButton>{c ? "Update" : "Add category"}</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
