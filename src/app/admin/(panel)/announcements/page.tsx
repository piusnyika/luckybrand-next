import { requireStaff } from "@/lib/admin/guard";
import { getAnnouncements, harareToday } from "@/lib/settings";
import { PageHeader, FlashToast } from "@/components/admin/ui";
import { AnnouncementsEditor } from "@/components/admin/AnnouncementsEditor";
import { saveAnnouncements } from "./actions";

export const metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function Announcements() {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const initial = await getAnnouncements();
  return (<>
    <FlashToast />
    <PageHeader title="Announcements" subtitle="Messages in the coloured bar at the top of every page: new address, holiday hours, promotions, delivery news. Several messages take turns."
      actions={<a href="/" target="_blank" className="btn-outline h-10 text-sm">View store</a>} />
    <AnnouncementsEditor initial={initial} today={harareToday()} action={saveAnnouncements} />
  </>);
}
