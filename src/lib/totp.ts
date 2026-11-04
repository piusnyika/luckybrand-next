import "server-only";
import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Time-based one-time codes (RFC 6238: 6 digits, 30 seconds, SHA-1), the kind authenticator apps
 * (Google Authenticator, Microsoft Authenticator, 1Password…) show for two-step login.
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export function newSecret() {
  const bytes = randomBytes(20); let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret: string) {
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) { const v = B32.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, "0"); }
  const out = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

function codeAt(secret: string, step: number) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** The step the code belongs to (now ±1 step for clock drift), or null. Reject steps <= lastStep so a code works once. */
export function checkCode(secret: string, code: string, lastStep?: number | null) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = Math.floor(Date.now() / 1000 / STEP);
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep != null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(c))) return step;
  }
  return null;
}

/** What the authenticator app scans */
export const otpauthUrl = (secret: string, account: string, issuer: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;

/** One-time recovery codes for when the phone is lost: shown once, stored hashed */
export function newRecoveryCodes(n = 8) {
  const codes = Array.from({ length: n }, () => randomBytes(5).toString("hex").replace(/(.{5})/, "$1-"));
  return { codes, hashes: codes.map(hashRecovery) };
}
export const hashRecovery = (code: string) => createHash("sha256").update(code.trim().toLowerCase().replace(/[^a-f0-9]/g, "")).digest("hex");
