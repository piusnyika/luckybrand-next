import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleEnabled, startLogin, GOOGLE_COOKIE } from "@/lib/google";

/** /api/auth/google/?next=/checkout/ : send the visitor to Google's account chooser */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) redirect("/my-account/");
  const n = req.nextUrl.searchParams.get("next") || "/my-account/";
  const next = n.startsWith("/") && !n.startsWith("//") ? n : "/my-account/";
  const { url, state, nonce, verifier } = startLogin(req.nextUrl.origin);
  (await cookies()).set(GOOGLE_COOKIE, JSON.stringify({ state, nonce, verifier, next }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google/", maxAge: 600,
  });
  redirect(url);
}
