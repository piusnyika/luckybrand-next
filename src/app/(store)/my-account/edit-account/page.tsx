import { requireUser } from "@/lib/auth";
import { AccountShell } from "@/components/store/AccountShell";
import { AccountForm } from "@/components/store/AccountForms";
export default async function EditAccount() {
  const u = await requireUser("/my-account/edit-account/");
  return <AccountShell active="/my-account/edit-account/" title="Account details"><AccountForm u={{ firstName: u.firstName, lastName: u.lastName, displayName: u.displayName, email: u.email }} /></AccountShell>;
}
