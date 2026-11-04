import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getSetting, getSite, type SeoSettings } from "@/lib/settings";
import "./globals.css";

const satoshi = localFont({ src: "./fonts/Satoshi-Variable.woff2", variable: "--font-satoshi", weight: "300 900", display: "swap" });

// Every page reads the site settings, and there is no database during the Docker image build.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [site, seo] = await Promise.all([getSite(), getSetting<SeoSettings>("seo")]);
  return {
    metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
    title: { default: site.seoTitle || site.name, template: `%s – ${site.name}` },
    description: site.seoDescription || site.tagline,
    icons: site.favicon ? { icon: site.favicon } : undefined,
    openGraph: { siteName: site.name, type: "website", locale: "en_US" },
    // Admin → SEO: proves to Google Search Console / Bing that the site is ours
    verification: { google: seo.googleVerification || undefined, other: seo.bingVerification ? { "msvalidate.01": seo.bingVerification } : undefined },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#004798" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={satoshi.variable}>
      <body>{children}</body>
    </html>
  );
}
