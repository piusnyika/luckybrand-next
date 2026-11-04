"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/admin/guard";
export async function deleteMessage(fd: FormData) { await requireStaff(); await db.delete(s.contactMessages).where(eq(s.contactMessages.id, Number(fd.get("id")))); redirect("/admin/messages/?msg=Deleted"); }
export async function deleteSubscriber(fd: FormData) { await requireStaff(); await db.delete(s.subscribers).where(eq(s.subscribers.id, Number(fd.get("id")))); redirect("/admin/messages/?tab=subscribers&msg=Removed"); }
