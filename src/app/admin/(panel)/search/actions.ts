"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { getSetting, saveSetting, type SearchSettings } from "@/lib/settings";
import { invalidateSearchIndex } from "@/lib/search";
import { prisma } from "@/lib/prisma";

/** Synonyms: one group per line, words or phrases separated by commas */
export async function saveSearchSettings(fd: FormData) {
  await requireStaff();
  const cur = await getSetting<SearchSettings>("search");
  const synonyms = String(fd.get("synonyms") || "").split(/\r?\n/)
    .map((line) => [...new Set(line.split(",").map((w) => w.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 20))
    .filter((g) => g.length > 1).slice(0, 300);
  const placeholder = String(fd.get("placeholder") ?? "").trim().slice(0, 80);
  await saveSetting("search", { ...cur, synonyms, placeholder });
  invalidateSearchIndex();
  refreshStore();
  redirect("/admin/search/?msg=Search%20settings%20saved");
}

export async function deleteSearchTerm(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id"));
  if (id) await prisma.$executeRaw`DELETE FROM search_terms WHERE id = ${id}`;
  redirect("/admin/search/?msg=Removed");
}

export async function clearSearchTerms(fd: FormData) {
  await requireStaff();
  if (fd.get("which") === "none") await prisma.$executeRaw`DELETE FROM search_terms WHERE last_results = 0`;
  else await prisma.$executeRaw`DELETE FROM search_terms`;
  redirect("/admin/search/?msg=Search%20log%20cleared");
}
