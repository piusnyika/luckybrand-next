import { requireUser } from "@/lib/auth";
import { AccountShell } from "@/components/store/AccountShell";
import { AddressForm } from "@/components/store/AccountForms";
export default async function EditAddress() {
  const u = await requireUser("/my-account/edit-address/");
  const b = (u.billing ?? {}) as Record<string, string>;
  return <AccountShell active="/my-account/edit-address/" title="Billing address"><AddressForm a={{ ...b, firstName: b.firstName || u.firstName, lastName: b.lastName || u.lastName, email: b.email || u.email, phone: b.phone || u.phone }} /></AccountShell>;
}
