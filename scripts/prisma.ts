// Runs the Prisma CLI with .env.local loaded (Prisma itself only reads .env).
// npm run db:migrate -- --name what_changed   |   npm run db:deploy   |   npm run db:studio
import "./load-env";
import { spawnSync } from "child_process";

const r = spawnSync("npx", ["prisma", ...process.argv.slice(2)], { stdio: "inherit", shell: true, env: process.env });
process.exit(r.status ?? 1);
