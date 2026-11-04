"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { deleteMedia, deleteMediaMany, mediaIdsWhere, mediaWhere } from "@/lib/admin/media";
import { prisma } from "@/lib/prisma";
export async function updateMedia(fd: FormData) {
  await requireStaff(); const id = Number(fd.get("id"));
  await prisma.media.update({ where: { id }, data: { alt: String(fd.get("alt") || ""), title: String(fd.get("title") || "") } });
  refreshStore(); redirect(`/admin/media/?id=${id}&msg=Saved`);
}
export async function bulkMedia(fd: FormData) {
  await requireStaff();
  const qs = String(fd.get("qs") || "");
  // "Select all N files": every file matching the current search/filter, not just this page
  const sel = fd.get("allMatching")
    ? await mediaIdsWhere(mediaWhere(String(fd.get("q") || "") || undefined, fd.get("show") === "unused"))
    : fd.getAll("sel").map(Number).filter(Boolean);
  let msg = "Nothing selected";
  if (sel.length && fd.get("bulk") === "delete") {
    const r = await deleteMediaMany(sel);
    msg = `${r.deleted} file(s) deleted` + (r.skipped ? `. ${r.skipped} skipped because they're used on the site (logo, homepage, pages, categories, brands or product descriptions)` : "");
    refreshStore();
  }
  redirect(`/admin/media/?${qs}${qs ? "&" : ""}msg=${encodeURIComponent(msg)}`);
}
export async function removeMedia(fd: FormData) { await requireStaff(); await deleteMedia(Number(fd.get("id"))); refreshStore(); redirect("/admin/media/?msg=Deleted"); }
