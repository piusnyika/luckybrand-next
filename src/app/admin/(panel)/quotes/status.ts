/** Quote request statuses: label and badge colours */
export const QUOTE_STATUS: Record<string, [string, string]> = {
  new: ["New", "bg-amber-100 text-amber-800"], quoted: ["Quoted", "bg-blue-100 text-blue-800"],
  won: ["Won", "bg-green-100 text-green-800"], lost: ["Lost", "bg-gray-100 text-gray-600"],
};
