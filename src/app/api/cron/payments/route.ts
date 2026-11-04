import { NextRequest, NextResponse } from "next/server";
import { syncPendingPayments } from "@/lib/payment-sync";

const g = globalThis as { __lbSyncToken?: string; __lbSyncRunning?: boolean };

/**
 * Runs the background payment check. Called every 5 minutes by src/instrumentation.ts (header x-sync-token),
 * or by an external cron job: /api/cron/payments/?secret=CRON_SECRET
 */
async function run(req: NextRequest) {
  const internal = !!g.__lbSyncToken && req.headers.get("x-sync-token") === g.__lbSyncToken;
  const external = !!process.env.CRON_SECRET && req.nextUrl.searchParams.get("secret") === process.env.CRON_SECRET;
  if (!internal && !external) return new NextResponse("forbidden", { status: 403 });
  if (g.__lbSyncRunning) return NextResponse.json({ skipped: "already running" });
  g.__lbSyncRunning = true;
  try { return NextResponse.json(await syncPendingPayments()); }
  catch (e) { console.error("payment check failed:", e); return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
  finally { g.__lbSyncRunning = false; }
}
export const GET = run;
export const POST = run;
