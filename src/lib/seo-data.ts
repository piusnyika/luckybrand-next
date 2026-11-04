import "server-only";
import { prisma, type Prisma } from "@/lib/prisma";
import { analyzeProduct, type SeoInput } from "./seo-score";
import { getSite } from "./settings";

/** What analyzeProduct needs, loaded for many products at once */
export async function seoInputs(where: Prisma.ProductWhereInput) {
  const titleSuffix = ` – ${(await getSite()).name}`;
  const rows = await prisma.product.findMany({
    where, select: {
      id: true, name: true, slug: true, seoTitle: true, seoDescription: true, focusKeyword: true, shortDescription: true, description: true,
      specification: true, attributes: true, status: true, imageId: true,
      images: { select: { media: { select: { alt: true } } } }, _count: { select: { categories: true } },
    },
  });
  return rows.map((p) => {
    const alts = p.images.map((i) => i.media.alt);
    // the main image may not be in the gallery list
    const imageCount = Math.max(alts.length, p.imageId ? 1 : 0);
    const input: SeoInput = {
      name: p.name, slug: p.slug, seoTitle: p.seoTitle, seoDescription: p.seoDescription ?? "", focusKeyword: p.focusKeyword,
      shortDescription: p.shortDescription ?? "", description: p.description ?? "", specification: p.specification ?? "",
      attributeCount: p.attributes?.length ?? 0, imageCount, imagesWithoutAlt: alts.filter((a) => !a.trim()).length, categoryCount: p._count.categories, titleSuffix,
    };
    return { id: p.id, name: p.name, slug: p.slug, status: p.status, input };
  });
}

export async function seoScores(where: Prisma.ProductWhereInput) {
  return (await seoInputs(where)).map((r) => ({ ...r, result: analyzeProduct(r.input) }));
}
