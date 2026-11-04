import "server-only";
import { revalidatePath } from "next/cache";
import { requireStaff, requireAdmin } from "../auth";
export { requireStaff, requireAdmin };
/** Refresh every cached storefront page after a change in the admin. */
export function refreshStore() { revalidatePath("/", "layout"); }
