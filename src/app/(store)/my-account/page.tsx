import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { googleEnabled } from "@/lib/google";
import { AccountShell } from "@/components/store/AccountShell";
import { LoginRegister } from "@/components/store/AccountForms";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
const GOOGLE_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.",
  expired: "Your Google sign-in took too long or was interrupted. Please try again.",
  unverified: "Your Google account's email address isn't verified, so we can't use it to sign you in.",
  blocked: "This account has been disabled. Please contact us if you think this is a mistake.",
  failed: "We couldn't sign you in with Google. Please try again or use your email and password.",
};
export default async function MyAccount({ searchParams }: { searchParams: Promise<{ next?: string; google_error?: string }> }) {
  const user = await getCurrentUser();
  const { next, google_error } = await searchParams;
  if (!user) return <div className="container"><Breadcrumbs items={[{ label: "My account" }]} />
    <LoginRegister next={next || "/my-account/"} google={googleEnabled()} googleError={google_error ? GOOGLE_ERRORS[google_error] ?? GOOGLE_ERRORS.failed : undefined} /></div>;
  return (
    <AccountShell active="/my-account/" title="Dashboard">
      <div className="space-y-4 text-[15px] text-ink-soft">
        <p>Hello <strong className="text-ink">{user.displayName || user.firstName || user.email}</strong> (not you? <Link href="/my-account/customer-logout/" className="text-primary underline" prefetch={false}>Log out</Link>)</p>
        <p>From your account dashboard you can view your <Link href="/my-account/orders/" className="text-primary">recent orders</Link>, manage your <Link href="/my-account/edit-address/" className="text-primary">billing address</Link>, and <Link href="/my-account/edit-account/" className="text-primary">edit your password and account details</Link>.</p>
        {(user.role === "admin" || user.role === "manager") && <p><Link href="/admin/" className="btn-primary">Go to store admin</Link></p>}
      </div>
    </AccountShell>
  );
}
