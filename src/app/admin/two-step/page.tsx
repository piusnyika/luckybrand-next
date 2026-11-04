import { redirect } from "next/navigation";
import { pendingLogin } from "@/lib/auth";
import { getSite } from "@/lib/settings";
import { TwoStepForm } from "@/components/admin/TwoStepForm";

export const metadata = { title: "Two-step login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TwoStep() {
  if (!(await pendingLogin())) redirect("/admin/login/");
  const site = await getSite();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 font-sans">
      <div className="w-full max-w-sm rounded-base border border-line bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo} alt={site.name} className="mx-auto mb-6 h-10" />
        <h1 className="mb-2 text-center text-lg font-semibold">Two-step login</h1>
        <p className="mb-6 text-center text-sm text-ink-soft">Enter the 6-digit code from your authenticator app.</p>
        <TwoStepForm />
      </div>
    </div>
  );
}
