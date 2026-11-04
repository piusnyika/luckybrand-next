import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSite } from "@/lib/settings";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
export const metadata = { title: "Admin login", robots: { index: false } };
export default async function AdminLogin() {
  const u = await getCurrentUser();
  if (u && (u.role === "admin" || u.role === "manager")) redirect("/admin/");
  const site = await getSite();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 font-sans">
      <div className="w-full max-w-sm rounded-base border border-line bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo} alt={site.name} className="mx-auto mb-6 h-10" />
        <h1 className="mb-6 text-center text-lg font-semibold">Store admin</h1>
        {u && <p className="mb-4 rounded-form bg-amber-50 px-3 py-2 text-sm text-amber-800">You are logged in as a customer. Log in with a staff account.</p>}
        <AdminLoginForm />
      </div>
    </div>
  );
}
