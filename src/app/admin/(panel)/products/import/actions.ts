"use server";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { importProducts, type ImportReport } from "@/lib/admin/product-csv";

export async function runProductImport(fd: FormData): Promise<ImportReport | { error: string }> {
  await requireStaff();
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return { error: "Please choose a CSV file." };
  if (/\.xlsx?$/i.test(f.name)) return { error: "Excel files can't be read directly. In Excel choose File → Save As → “CSV UTF-8 (Comma delimited)”, then upload that file." };
  if (f.size > 10 * 1024 * 1024) return { error: "The file is larger than 10 MB. Please split it into smaller files." };
  const dryRun = fd.get("mode") !== "import";
  try {
    const r = await importProducts(await f.text(), dryRun, { moveTables: fd.get("moveTables") === "1" });
    if (!dryRun && (r.created || r.updated)) refreshStore();
    return r;
  } catch (e: any) { return { error: e.message || String(e) }; }
}
