import Link from "next/link";
import { Breadcrumbs } from "./Breadcrumbs";
import { logout } from "@/app/(store)/my-account/actions";
import { Icon } from "../Icon";

const NAV = [
  { href: "/my-account/", label: "Dashboard", icon: "dashboard" },
  { href: "/my-account/orders/", label: "Orders", icon: "receipt" },
  { href: "/my-account/edit-address/", label: "Addresses", icon: "pin" },
  { href: "/my-account/edit-account/", label: "Account details", icon: "user" },
  { href: "/wishlist/", label: "Wishlist", icon: "heart" },
];
export function AccountShell({ active, title, children }: { active: string; title: string; children: React.ReactNode }) {
  return (
    <div className="container">
      <Breadcrumbs items={[{ label: "My account", href: "/my-account/" }, ...(title !== "Dashboard" ? [{ label: title }] : [])]} />
      <div className="grid gap-8 pb-6 lg:grid-cols-[250px_1fr]">
        <nav className="h-fit overflow-hidden rounded-base border border-line">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`flex items-center gap-3 border-b border-line px-5 py-3.5 text-sm font-medium last:border-0 ${active === n.href ? "bg-primary text-white" : "hover:bg-surface"}`}>
              <Icon name={n.icon} size={18} />{n.label}
            </Link>
          ))}
          <form action={logout}><button className="flex w-full items-center gap-3 px-5 py-3.5 text-sm font-medium hover:bg-surface"><Icon name="logout" size={18} />Log out</button></form>
        </nav>
        <div><h1 className="mb-6 text-2xl font-semibold">{title}</h1>{children}</div>
      </div>
    </div>
  );
}
