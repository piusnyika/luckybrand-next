"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { saveSetting } from "@/lib/settings";
export async function saveHomepage(fd: FormData) {
  await requireStaff();
  const data = JSON.parse(String(fd.get("data") || "{}"));
  await saveSetting("homepage", { slides: data.slides ?? [], sections: data.sections ?? [] });
  refreshStore(); redirect("/admin/homepage/?msg=Homepage%20saved");
}
