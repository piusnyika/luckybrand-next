import { readFileSync, existsSync } from "fs";
for (const f of [".env.local", ".env"]) if (existsSync(f)) for (const l of readFileSync(f, "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
