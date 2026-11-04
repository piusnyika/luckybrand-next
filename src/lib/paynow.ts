import "server-only";
import { createHash } from "crypto";

const INIT_URL = "https://www.paynow.co.zw/interface/initiatetransaction";
const PAID = ["paid", "awaiting delivery", "delivered"];
const FAILED = ["cancelled", "failed", "disputed", "refunded"];

const creds = () => {
  const id = process.env.PAYNOW_INTEGRATION_ID, key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!id || !key) throw new Error("Paynow is not configured (PAYNOW_INTEGRATION_ID / PAYNOW_INTEGRATION_KEY).");
  return { id, key };
};
const hash = (values: string[], key: string) => createHash("sha512").update(values.join("") + key, "utf8").digest("hex").toUpperCase();

function parse(body: string) {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k.toLowerCase()] = v;
  return out;
}
/** Paynow signs every message: hash = SHA512(all values in order, except hash, + key) */
export function verify(fields: Record<string, string>, rawOrder?: string[]) {
  const { key } = creds();
  const keys = rawOrder ?? Object.keys(fields);
  const values = keys.filter((k) => k.toLowerCase() !== "hash").map((k) => fields[k] ?? fields[k.toLowerCase()] ?? "");
  return (fields.hash || fields.Hash || "").toUpperCase() === hash(values, key);
}
function parseOrdered(body: string) {
  const order: string[] = []; const fields: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) { order.push(k); fields[k] = v; }
  return { order, fields };
}

export async function initiate(o: { reference: string; amount: number; info: string; email: string; returnUrl: string; resultUrl: string }) {
  const { id, key } = creds();
  const fields: [string, string][] = [
    ["id", id], ["reference", o.reference], ["amount", o.amount.toFixed(2)], ["additionalinfo", o.info],
    ["returnurl", o.returnUrl], ["resulturl", o.resultUrl], ["authemail", o.email], ["status", "Message"],
  ];
  const body = new URLSearchParams([...fields, ["hash", hash(fields.map((f) => f[1]), key)]]);
  const res = await fetch(INIT_URL, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  const text = await res.text();
  const { order, fields: r } = parseOrdered(text);
  const status = (r.status || r.Status || "").toLowerCase();
  if (status !== "ok") throw new Error("Paynow: " + (r.error || r.Error || text.slice(0, 200)));
  if (!verify(r, order)) throw new Error("Paynow: response hash mismatch");
  return { browserUrl: r.browserurl || r.BrowserUrl, pollUrl: r.pollurl || r.PollUrl };
}

const MOBILE_URL = "https://www.paynow.co.zw/interface/remotetransaction";
export type MobileMethod = "ecocash" | "onemoney";

/** Paynow "07xxxxxxxx" format from +263 / 263 / spaced input */
export function normalisePhone(raw: string) {
  const d = raw.replace(/[^\d]/g, "").replace(/^263/, "0").replace(/^(7\d{8})$/, "0$1");
  return /^07\d{8}$/.test(d) ? d : null;
}
/** Econet 077/078 → EcoCash, NetOne 071 → OneMoney */
export const guessMethod = (phone: string): MobileMethod | null => (/^07[78]/.test(phone) ? "ecocash" : /^071/.test(phone) ? "onemoney" : null);

/** Mobile ("express") checkout: Paynow pushes a PIN prompt to the customer's phone. No redirect; poll for the result. */
export async function initiateMobile(o: { reference: string; amount: number; info: string; email: string; returnUrl: string; resultUrl: string; phone: string; method: MobileMethod }) {
  const { id, key } = creds();
  const fields: [string, string][] = [
    ["id", id], ["reference", o.reference], ["amount", o.amount.toFixed(2)], ["additionalinfo", o.info],
    ["returnurl", o.returnUrl], ["resulturl", o.resultUrl], ["authemail", o.email], ["phone", o.phone], ["method", o.method], ["status", "Message"],
  ];
  const body = new URLSearchParams([...fields, ["hash", hash(fields.map((f) => f[1]), key)]]);
  const res = await fetch(MOBILE_URL, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  const text = await res.text();
  const { order, fields: r } = parseOrdered(text);
  const status = (r.status || r.Status || "").toLowerCase();
  if (status !== "ok") throw new Error("Paynow: " + (r.error || r.Error || text.slice(0, 200)));
  if (!verify(r, order)) throw new Error("Paynow: response hash mismatch");
  return { pollUrl: r.pollurl || r.PollUrl, instructions: r.instructions || r.Instructions || "", paynowReference: r.paynowreference || r.PaynowReference || "" };
}

export type PaynowStatus = { status: string; paid: boolean; failed: boolean; paynowReference: string; amount: string; reference: string };
export function interpret(body: string): PaynowStatus | null {
  const { order, fields } = parseOrdered(body);
  if (!verify(fields, order)) return null;
  const f = parse(body);
  const st = (f.status || "").toLowerCase();
  return { status: f.status || "", paid: PAID.includes(st), failed: FAILED.includes(st), paynowReference: f.paynowreference || "", amount: f.amount || "", reference: f.reference || "" };
}
export async function poll(pollUrl: string) {
  const res = await fetch(pollUrl, { method: "POST" });
  return interpret(await res.text());
}
