import "server-only";
import { createHash, randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/** Sign in with Google (OAuth 2.0 authorization code flow + PKCE). Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to enable. */
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const GOOGLE_COOKIE = "lb_google";

const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const b64url = (b: Buffer) => b.toString("base64url");

export const callbackUrl = (origin: string) => `${process.env.SITE_URL || origin}/api/auth/google/callback/`;

export function startLogin(origin: string) {
  const state = b64url(randomBytes(24)), nonce = b64url(randomBytes(24)), verifier = b64url(randomBytes(32));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: callbackUrl(origin), response_type: "code",
    scope: "openid email profile", state, nonce, prompt: "select_account",
    code_challenge: b64url(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), state, nonce, verifier };
}

export type GoogleProfile = { sub: string; email: string; firstName: string; lastName: string; name: string };

/** Exchanges the code and verifies Google's signed ID token. Throws on anything unexpected. */
export async function finishLogin(origin: string, code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(origin), grant_type: "authorization_code", code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.id_token) throw new Error(`token exchange failed: ${tok.error_description || tok.error || res.status}`);
  const { payload: p } = await jwtVerify(tok.id_token, jwks, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: process.env.GOOGLE_CLIENT_ID! });
  if (p.nonce !== nonce) throw new Error("nonce mismatch");
  if (!p.email || p.email_verified !== true) throw new Error("unverified");
  return {
    sub: String(p.sub), email: String(p.email).toLowerCase(),
    firstName: String(p.given_name ?? ""), lastName: String(p.family_name ?? ""), name: String(p.name ?? ""),
  };
}
