import { requireStaff } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { getSite } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const site = await getSite();
  const [processing, unread, quotes, reviews] = await Promise.all([
    prisma.order.count({ where: { status: "processing" } }),
    prisma.contactMessage.count({ where: { read: false } }),
    prisma.quoteRequest.count({ where: { status: "new" } }),
    prisma.review.count({ where: { status: "pending" } }),
  ]);
  return (
    <div className="min-h-screen bg-[#f4f6f8] font-sans text-ink lg:flex">
      <AdminNav user={{ name: user.displayName || user.email, role: user.role }} logo={site.logo} badges={{ orders: processing, messages: unread, quotes, reviews }} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1280px] p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
