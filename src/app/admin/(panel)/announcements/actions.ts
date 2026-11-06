"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { saveSetting, type Announcement, type AnnouncementSettings } from "@/lib/settings";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const colour = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
/** site paths, or http(s) links only (never javascript: etc.) */
const link = (v: unknown) => { const s = str(v, 500); return /^\/(?!\/)/.test(s) || /^https?:\/\//i.test(s) ? s : ""; };

export async function saveAnnouncements(fd: FormData) {
  await requireStaff();
  let raw: Partial<AnnouncementSettings> = {};
  try { raw = JSON.parse(String(fd.get("data") || "{}")); } catch { redirect("/admin/announcements/?msg=Error%3A%20could%20not%20read%20the%20form"); }
  const items: Announcement[] = (Array.isArray(raw.items) ? raw.items : []).slice(0, 20).map((m: Partial<Announcement>) => ({
    id: str(m.id, 20).replace(/[^a-z0-9]/gi, "") || Math.random().toString(36).slice(2, 10),
    label: str(m.label, 30), text: str(m.text, 200), link: link(m.link), linkLabel: str(m.linkLabel, 30),
    bg: colour(m.bg, "#004798"), color: colour(m.color, "#ffffff"), startsOn: day(m.startsOn), endsOn: day(m.endsOn), enabled: m.enabled !== false,
  }));
  const settings: AnnouncementSettings = {
    enabled: raw.enabled !== false, dismissible: raw.dismissible !== false,
    seconds: Math.min(60, Math.max(3, Math.round(Number(raw.seconds) || 6))), items,
  };
  await saveSetting("announcements", settings);
  refreshStore();
  redirect("/admin/announcements/?msg=Announcements%20saved");
}
