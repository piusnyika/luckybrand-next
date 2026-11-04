import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { LostPasswordForm } from "@/components/store/AccountForms";
export const metadata = { title: "Lost password", robots: { index: false } };
export default function LostPassword() { return <div className="container"><Breadcrumbs items={[{ label: "My account", href: "/my-account/" }, { label: "Lost password" }]} /><LostPasswordForm /></div>; }
