import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ResetPasswordForm } from "@/components/store/AccountForms";
export const metadata = { title: "Reset password", robots: { index: false } };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <div className="container"><Breadcrumbs items={[{ label: "My account", href: "/my-account/" }, { label: "Reset password" }]} /><ResetPasswordForm token={token} /></div>;
}
