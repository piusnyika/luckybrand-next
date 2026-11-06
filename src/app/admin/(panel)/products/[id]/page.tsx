import { requireStaff } from "@/lib/auth";
import { getSite } from "@/lib/settings";
import { notFound } from "next/navigation";
import { getAllCategories, productRelations } from "@/lib/catalog";
import { PageHeader, FlashToast, ConfirmButton, SubmitButton } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { deleteProduct, duplicateProduct, restoreProduct, saveProduct, trashProduct } from "../actions";
import { TRASH_DAYS } from "@/lib/admin/product-trash";
import { formatDate } from "@/lib/format";
import { getBundleItems } from "@/lib/bundles";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return { title: (await params).id === "new" ? "Add product" : "Edit product" }; }

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const { id } = await params; const isNew = id === "new";
  const found = isNew ? null : await prisma.product.findUnique({ where: { id: Number(id) } });
  // a plain copy: Prisma result objects carry a hidden symbol property that React refuses to pass to client components
  const p = found && (Object.fromEntries(Object.entries(found)) as typeof found);
  if (!isNew && !p) notFound();
  const bundle = p?.type === "bundle" ? (await getBundleItems([p.id])).get(p.id) ?? [] : [];
  const [cats, brands, tags, rel] = await Promise.all([
    getAllCategories(), prisma.brand.findMany({ orderBy: { name: "asc" } }), prisma.tag.findMany({ orderBy: { name: "asc" } }),
    p ? productRelations(p.id, p.name) : Promise.resolve({ gallery: [], categoryList: [], brandList: [], tagList: [] }),
  ]);
  return (
    <>
      <FlashToast />
      <PageHeader title={isNew ? "Add product" : p!.name} back="/admin/products/"
        actions={p && <>
          <a href={`/product/${p.slug}/`} target="_blank" className="btn-outline h-10 text-sm">View on store</a>
          <form action={duplicateProduct}><input type="hidden" name="id" value={p.id} /><button className="btn-outline h-10 text-sm">Duplicate</button></form>
        </>} />
      {p?.status === "trash" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-form border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
          <span><strong>This product is in the trash</strong> and hidden from the store.{p.trashedAt && ` It will be deleted permanently on ${formatDate(new Date(p.trashedAt.getTime() + TRASH_DAYS * 86_400_000))}.`}</span>
          <form className="flex items-center gap-3">
            <input type="hidden" name="id" value={p.id} />
            <ConfirmButton formAction={deleteProduct} message="Delete this product permanently? This cannot be undone.">Delete permanently</ConfirmButton>
            <SubmitButton formAction={restoreProduct} className="btn-primary h-9 text-sm" pendingText="Restoring…">Restore</SubmitButton>
          </form>
        </div>
      )}
      <ProductForm titleSuffix={` – ${(await getSite()).name}`} action={saveProduct} deleteAction={trashProduct} product={p ? {
        ...p, regularPrice: String(p.regularPrice), salePrice: p.salePrice ? String(p.salePrice) : "",
        saleFrom: p.saleFrom ? p.saleFrom.toISOString().slice(0, 10) : "", saleTo: p.saleTo ? p.saleTo.toISOString().slice(0, 10) : "",
      } : null}
        bundleItems={bundle.map((i) => ({ productId: i.productId, qty: i.qty, name: i.name, sku: i.sku, image: i.image, price: i.price, missing: i.missing,
          stock: i.stockStatus === "outofstock" ? "Out of stock" : i.manageStock ? `${i.stockQty ?? 0} in stock` : i.stockStatus === "onbackorder" ? "Backorder" : "In stock" }))}
        images={rel.gallery.map((g) => ({ id: g.id, url: g.url }))} selectedCats={rel.categoryList.map((c) => c.id)} selectedBrands={rel.brandList.map((b) => b.id)} selectedTags={rel.tagList.map((t) => t.id)}
        categories={cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))} brands={brands.map((b) => ({ id: b.id, name: b.name }))} tags={tags.map((t) => ({ id: t.id, name: t.name }))} />
    </>
  );
}
