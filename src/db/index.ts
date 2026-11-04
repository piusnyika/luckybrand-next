import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const g = globalThis as unknown as { __pool?: mysql.Pool };
const pool = g.__pool ?? mysql.createPool({ uri: process.env.DATABASE_URL!, connectionLimit: 10, dateStrings: false, timezone: "Z" });
// Store and read every date in UTC, whatever the server's own timezone is.
if (!g.__pool) (pool as any).pool?.on?.("connection", (c: any) => c.query("SET time_zone = '+00:00'"));
if (process.env.NODE_ENV !== "production") g.__pool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
export type DB = typeof db;
