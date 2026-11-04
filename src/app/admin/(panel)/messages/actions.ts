"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
export async function deleteMessage(fd: FormData) { await requireStaff(); await prisma.contactMessage.deleteMany({ where: { id: Number(fd.get("id")) } }); redirect("/admin/messages/?msg=Deleted"); }
export async function deleteSubscriber(fd: FormData) { await requireStaff(); await prisma.subscriber.deleteMany({ where: { id: Number(fd.get("id")) } }); redirect("/admin/messages/?tab=subscribers&msg=Removed"); }
