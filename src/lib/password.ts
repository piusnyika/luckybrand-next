import bcrypt from "bcryptjs";
import { createHash, createHmac } from "crypto";

const itoa64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encode64(input: Buffer, count: number) {
  let output = ""; let i = 0;
  do {
    let value = input[i++];
    output += itoa64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += itoa64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += itoa64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += itoa64[(value >> 18) & 0x3f];
  } while (i < count);
  return output;
}

/** WordPress legacy phpass ($P$ / $H$) */
function phpassCheck(password: string, stored: string) {
  const countLog2 = itoa64.indexOf(stored[3]);
  if (countLog2 < 7 || countLog2 > 30) return false;
  let count = 1 << countLog2;
  const salt = stored.substring(4, 12);
  if (salt.length !== 8) return false;
  const pw = Buffer.from(password, "utf8");
  let hash = createHash("md5").update(Buffer.concat([Buffer.from(salt, "binary"), pw])).digest();
  do { hash = createHash("md5").update(Buffer.concat([hash, pw])).digest(); } while (--count);
  return stored.substring(0, 12) + encode64(hash, 16) === stored;
}

const fixPrefix = (h: string) => h.replace(/^\$2y\$/, "$2b$");

/** Verifies passwords from WordPress (phpass, WP 6.8 bcrypt, plain bcrypt) and our own hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("$wp$")) {
    const pre = createHmac("sha384", "wp-sha384").update(password.trim()).digest("base64");
    return bcrypt.compare(pre, fixPrefix(stored.slice(3)));
  }
  if (stored.startsWith("$P$") || stored.startsWith("$H$")) return phpassCheck(password, stored);
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compare(password, fixPrefix(stored));
  if (/^[a-f0-9]{32}$/.test(stored)) return createHash("md5").update(password).digest("hex") === stored; // very old WP
  return false;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
/** true when the stored hash should be upgraded to our native format after a successful login */
export const needsRehash = (stored: string) => !stored.startsWith("$2b$");
