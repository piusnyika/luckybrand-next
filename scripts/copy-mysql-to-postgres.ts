// One-off: copies every table from the old MySQL database (MYSQL_DATABASE_URL) into Postgres (DATABASE_URL).
// MySQL is only read. Postgres tables must be empty (run `npm run db:deploy` first), or pass --replace to empty them.
//   npx tsx scripts/copy-mysql-to-postgres.ts [--replace]
// Rows whose links point at something that no longer exists (e.g. a gallery image of a deleted product) can't be
// kept under the new foreign keys: required links are dropped, optional ones set to NULL, and both are listed.
import "./load-env";
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const replace = process.argv.includes("--replace");

// parents before children
const TABLES = [
  "users", "media", "categories", "brands", "tags", "products", "product_categories", "product_brands", "product_tags",
  "product_images", "product_bundle_items", "orders", "order_items", "order_notes", "coupons", "shipping_methods",
  "pages", "menu_items", "settings", "redirects", "subscribers", "contact_messages",
];
/** [table, column, parent table, required]: required links drop the row, optional ones become NULL */
const LINKS: [string, string, string, boolean][] = [
  ["categories", "parent_id", "categories", false],
  ["products", "primary_category_id", "categories", false],
  ["products", "image_id", "media", false],
  ["product_categories", "product_id", "products", true], ["product_categories", "category_id", "categories", true],
  ["product_brands", "product_id", "products", true], ["product_brands", "brand_id", "brands", true],
  ["product_tags", "product_id", "products", true], ["product_tags", "tag_id", "tags", true],
  ["product_images", "product_id", "products", true], ["product_images", "media_id", "media", true],
  ["product_bundle_items", "bundle_id", "products", true], // product_id has no foreign key on purpose
  ["orders", "user_id", "users", false],
  ["order_items", "order_id", "orders", true], ["order_items", "product_id", "products", false],
  ["order_notes", "order_id", "orders", true],
];

type Col = { name: string; udt: string; nullable: boolean };

async function main() {
  const url = process.env.MYSQL_DATABASE_URL;
  if (!url) throw new Error("Set MYSQL_DATABASE_URL (the old Laragon database) in .env.local");
  const my = await mysql.createConnection({ uri: url, timezone: "Z", dateStrings: false, supportBigNumbers: true, bigNumberStrings: true });
  await my.query("SET time_zone = '+00:00'");

  const pgCols = new Map<string, Col[]>();
  for (const t of TABLES) {
    const cols = await prisma.$queryRaw<{ column_name: string; udt_name: string; is_nullable: string }[]>`
      SELECT column_name, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${t} ORDER BY ordinal_position`;
    if (!cols.length) throw new Error(`Postgres has no table ${t}: run npm run db:deploy first`);
    pgCols.set(t, cols.map((c) => ({ name: c.column_name, udt: c.udt_name, nullable: c.is_nullable === "YES" })));
  }

  const counts = await prisma.$queryRawUnsafe<{ t: string; n: bigint }[]>(TABLES.map((t) => `SELECT '${t}' AS t, COUNT(*) AS n FROM "${t}"`).join(" UNION ALL "));
  const notEmpty = counts.filter((c) => Number(c.n) > 0);
  if (notEmpty.length && !replace) throw new Error(`Postgres already has data (${notEmpty.map((c) => `${c.t}: ${c.n}`).join(", ")}). Re-run with --replace to empty it first.`);

  // read everything first, so orphans can be checked against what will really be in Postgres
  const data = new Map<string, Record<string, unknown>[]>();
  for (const t of TABLES) {
    const [exists] = await my.query<mysql.RowDataPacket[]>("SHOW TABLES LIKE ?", [t]);
    data.set(t, exists.length ? ((await my.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${t}\``))[0] as Record<string, unknown>[]) : []);
    if (!exists.length) console.log(`  (MySQL has no ${t} table: skipped)`);
  }
  await my.end();

  const report: string[] = [];
  for (const [t, col, parent, required] of LINKS) {
    const ids = new Set((data.get(parent) ?? []).map((r) => String(r.id)));
    const rows = data.get(t) ?? [];
    const bad = rows.filter((r) => r[col] != null && !ids.has(String(r[col])));
    if (!bad.length) continue;
    if (required) data.set(t, rows.filter((r) => !bad.includes(r)));
    else for (const r of bad) r[col] = null;
    report.push(`${t}: ${bad.length} row(s) pointed at a missing ${parent} row via ${col}: ${required ? "dropped" : "set to NULL"}` +
      ` (e.g. ${bad.slice(0, 5).map((r) => `${col}=${r[col] ?? "?"}`).join(", ")})`);
  }

  const convert = (v: unknown, c: Col, t: string) => {
    if (v === null || v === undefined) return null;
    if (c.udt === "bool") return v === true || v === 1 || v === "1";
    if (c.udt === "jsonb" || c.udt === "json") return typeof v === "string" ? v : JSON.stringify(v);
    if (c.udt.startsWith("timestamp")) {
      const d = v instanceof Date ? v : new Date(String(v));
      if (isNaN(d.getTime())) { if (!c.nullable) throw new Error(`${t}.${c.name}: invalid date and the column can't be empty`); return null; }
      return d;
    }
    if (c.udt === "numeric") return String(v);
    if (c.udt.startsWith("int")) return Number(v);
    return Buffer.isBuffer(v) ? v.toString("utf8") : String(v);
  };

  await prisma.$transaction(async (tx) => {
    if (replace) await tx.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
    for (const t of TABLES) {
      const rows = data.get(t)!;
      if (!rows.length) continue;
      const cols = pgCols.get(t)!.filter((c) => c.name in rows[0]);
      const missing = pgCols.get(t)!.filter((c) => !(c.name in rows[0])).map((c) => c.name);
      const extra = Object.keys(rows[0]).filter((k) => !cols.some((c) => c.name === k));
      if (missing.length) report.push(`${t}: not in MySQL, left at their defaults: ${missing.join(", ")}`);
      if (extra.length) report.push(`${t}: MySQL columns not copied (no longer in the schema): ${extra.join(", ")}`);
      const per = Math.max(1, Math.floor(30000 / cols.length));
      for (let i = 0; i < rows.length; i += per) {
        const chunk = rows.slice(i, i + per); const params: unknown[] = [];
        const values = chunk.map((r) => "(" + cols.map((c) => { params.push(convert(r[c.name], c, t)); return `$${params.length}::"${c.udt}"`; }).join(", ") + ")");
        await tx.$executeRawUnsafe(`INSERT INTO "${t}" (${cols.map((c) => `"${c.name}"`).join(", ")}) VALUES ${values.join(", ")}`, ...params);
      }
      // next new row continues after the copied ids
      if (pgCols.get(t)!.some((c) => c.name === "id" && c.udt === "int4"))
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${t}"`);
      console.log(`  ${t}: ${rows.length}`);
    }
  }, { timeout: 30 * 60_000, maxWait: 60_000 });

  // verify
  const after = await prisma.$queryRawUnsafe<{ t: string; n: bigint }[]>(TABLES.map((t) => `SELECT '${t}' AS t, COUNT(*) AS n FROM "${t}"`).join(" UNION ALL "));
  const wrong = after.filter((a) => Number(a.n) !== (data.get(a.t)?.length ?? 0));
  console.log(wrong.length ? `\nROW COUNT MISMATCH: ${wrong.map((w) => `${w.t} ${w.n} vs ${data.get(w.t)?.length}`).join(", ")}` : "\nRow counts match for every table.");
  if (report.length) console.log("\nNotes:\n- " + report.join("\n- "));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
