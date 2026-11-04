import { defineConfig } from "drizzle-kit";
import { readFileSync, existsSync } from "fs";
// load .env / .env.local manually (drizzle-kit doesn't)
for (const f of [".env", ".env.local"]) if (existsSync(f)) for (const l of readFileSync(f, "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
export default defineConfig({ schema: "./src/db/schema.ts", out: "./drizzle", dialect: "mysql", dbCredentials: { url: process.env.DATABASE_URL! } });
