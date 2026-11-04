import { requireStaff } from "@/lib/auth";
import { PageHeader, Card, Table, th, td } from "@/components/admin/ui";
import { ProductImport } from "@/components/admin/ProductImport";

export const metadata = { title: "Import products" };

const COLS: [string, string][] = [
  ["sku", "Used to find an existing product. Rows with a matching SKU update that product; otherwise a new product is created."],
  ["id / slug", "Alternative ways to match an existing product (the id from our own export)."],
  ["name", "Required for new products."],
  ["status", "published or draft. New products without a price are saved as drafts."],
  ["regular_price, sale_price", "Numbers, e.g. 199.00"],
  ["sale_from, sale_to", "Optional sale dates, YYYY-MM-DD"],
  ["stock_qty", "Quantity in stock. Filling it in turns on stock tracking and sets in/out of stock automatically."],
  ["stock_status", "instock, outofstock or onbackorder (for products without stock tracking)"],
  ["manage_stock, featured", "1 or 0"],
  ["categories", "Separate with | , use > for sub-categories: Phones > Smartphones | Deals"],
  ["brands, tags", "Separate with |. Missing ones are created."],
  ["bundle_items", "Makes the product a bundle: SKU*quantity separated with |, e.g. SOL-INV-5K*1 | BAT-200AH*2. Its price and stock then come from those products, so any price in the file is ignored. Put - to turn a bundle back into a single product."],
  ["images", "Image links separated with |. The first one is the main image. Links are downloaded into the media library; existing /uploads/ files are reused."],
  ["short_description, description", "Text or HTML"],
  ["low_stock_amount, weight, badge_text, seo_title, seo_description", "Optional"],
];

export default async function ImportProducts() {
  await requireStaff();
  return (<>
    <PageHeader title="Import products" back="/admin/products/" subtitle="Add or update many products at once from a CSV file (Excel → Save As → CSV UTF-8)." actions={<>
      <a href="/api/admin/products-export/?template=1" className="btn-outline h-10 text-sm">Download template</a>
      <a href="/api/admin/products-export/" className="btn-outline h-10 text-sm">Export all products</a>
    </>} />
    <Card className="mb-6" title="Upload"><ProductImport /></Card>
    <Card title="How it works">
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li><strong>Check file</strong> shows what will happen without saving anything. Then click <strong>Import</strong>.</li>
        <li>Only the columns in your file are changed. To update prices only, a file with just <code>sku</code> and <code>regular_price</code> is enough.</li>
        <li>Empty cells leave the current value unchanged. Put a single <code>-</code> in a cell to clear it (e.g. remove a sale price).</li>
        <li>Easiest way to edit in bulk: <strong>Export all products</strong>, change it in Excel, and import it back.</li>
      </ul>
      <Table head={<><th className={th}>Column</th><th className={th}>What to put in it</th></>}>
        {COLS.map(([c, d]) => <tr key={c}><td className={`${td} whitespace-nowrap font-mono text-xs`}>{c}</td><td className={`${td} text-sm`}>{d}</td></tr>)}
      </Table>
    </Card>
  </>);
}
