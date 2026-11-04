import { NextRequest, NextResponse } from "next/server";

// Runs on the Node.js runtime so it can read the redirects table.
export const config = { runtime: "nodejs", matcher: ["/((?!_next/|favicon).*)"] };

/** Old / alternative domains → the live one (luckybrand.co.zw), same path. Only once SITE_URL is the live https address. */
const ALIAS_HOSTS = ["luckybrandonline.co.zw", "www.luckybrandonline.co.zw", "www.luckybrand.co.zw"];
function domainRedirect(req: NextRequest) {
  const site = process.env.SITE_URL || "";
  if (!site.startsWith("https://")) return null; // local / test setups
  // GET/HEAD only: never redirect a payment callback or form POST (it would lose its body)
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  const target = new URL(site);
  if (!ALIAS_HOSTS.includes(host) || host === target.host) return null;
  return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, target), 301);
}

let cache: { at: number; map: Map<string, { to: string; code: number; id: number }> } | null = null;
async function redirects() {
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.redirect.findMany();
  cache = { at: Date.now(), map: new Map(rows.map((r) => [normalise(r.from), { to: r.to, code: r.code, id: r.id }])) };
  return cache.map;
}
const normalise = (p: string) => { try { p = decodeURIComponent(p); } catch {} p = p.split("?")[0].toLowerCase(); return p.endsWith("/") ? p : p + "/"; };

export async function middleware(req: NextRequest) {
  const moved = domainRedirect(req);
  if (moved) return moved;
  const url = req.nextUrl; const path = url.pathname;
  // old WordPress image links (Google Images, shared links) → same file under /uploads/
  if (path.startsWith("/wp-content/uploads/")) return NextResponse.redirect(new URL(path.replace("/wp-content/uploads/", "/uploads/"), req.url), 301);
  // the redirects below are for storefront pages only
  if (/^\/(api|uploads|admin)\//.test(path) || path === "/icons.svg") return NextResponse.next();
  // WordPress leftovers
  if (path === "/wp-login.php" || path.startsWith("/wp-admin")) return NextResponse.redirect(new URL(path.startsWith("/wp-admin") ? "/admin/" : "/my-account/", req.url), 301);
  if (/^\/(feed|comments\/feed)\/?$/.test(path) || path === "/xmlrpc.php") return new NextResponse(null, { status: 410 });
  if (url.searchParams.get("post_type") === "product" && url.searchParams.has("s")) return NextResponse.redirect(new URL(`/shop/?s=${encodeURIComponent(url.searchParams.get("s")!)}`, req.url), 301);
  const sp = path.match(/^\/shop\/page\/(\d+)\/?$/);
  if (sp) return NextResponse.redirect(new URL(`/shop/?paged=${sp[1]}`, req.url), 301);
  if (path.startsWith("/product-brand/")) return NextResponse.redirect(new URL(path.replace("/product-brand/", "/brand/"), req.url), 301);

  try {
    const hit = (await redirects()).get(normalise(path));
    if (hit) {
      import("@/lib/prisma").then(({ prisma }) => prisma.redirect.updateMany({ where: { id: hit.id }, data: { hits: { increment: 1 } } })).catch(() => {});
      return NextResponse.redirect(new URL(hit.to, req.url), hit.code);
    }
  } catch { /* DB not reachable: carry on */ }
  return NextResponse.next();
}
