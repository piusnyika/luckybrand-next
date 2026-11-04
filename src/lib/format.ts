const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Africa/Harare";
export function money(v: number | string | null | undefined, symbol = "$") {
  const n = Number(v ?? 0);
  return symbol + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}
export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}
/** JSON for a <script> tag: "<" can't close the tag, whatever the data contains */
export const jsonLd = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
/** CSV cell: text starting like a formula is neutralised so spreadsheets don't run it (phone numbers and amounts stay as they are) */
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().,-]+$/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
export function stripHtml(h: string | null | undefined) {
  return String(h ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
export const ORDER_STATUSES = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending payment", processing: "Processing", "on-hold": "On hold", completed: "Completed",
  cancelled: "Cancelled", refunded: "Refunded", failed: "Failed",
};
export const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700", processing: "bg-green-100 text-green-800", "on-hold": "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800", cancelled: "bg-gray-200 text-gray-600", refunded: "bg-gray-200 text-gray-600", failed: "bg-red-100 text-red-700",
};
