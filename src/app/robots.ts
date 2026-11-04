import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL || "http://localhost:3000";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/cart/", "/checkout/", "/my-account/", "/wishlist/", "/compare/", "/*?*orderby=", "/*?*s="] }], sitemap: `${base}/sitemap.xml` };
}
