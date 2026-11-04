import { requireStaff } from "@/lib/auth";
import { getSetting, type HomepageSettings } from "@/lib/settings";
import { getAllCategories } from "@/lib/catalog";
import { PageHeader, FlashToast } from "@/components/admin/ui";
import { HomepageEditor } from "@/components/admin/HomepageEditor";
import { saveHomepage } from "./actions";
export const metadata = { title: "Homepage" };
export const dynamic = "force-dynamic";
export default async function Homepage() {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const [home, cats] = await Promise.all([getSetting<HomepageSettings>("homepage"), getAllCategories()]);
  return (
    <>
      <FlashToast />
      <PageHeader title="Homepage" subtitle="Slider and product sections shown on the home page, top to bottom." actions={<a href="/" target="_blank" className="btn-outline h-10 text-sm">View homepage</a>} />
      <HomepageEditor action={saveHomepage} initial={home} categories={cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))} />
    </>
  );
}
