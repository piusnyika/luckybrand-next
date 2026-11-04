import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { ASSISTANT_MODELS, getSetting, getSite, type SeoSettings } from "./settings";
import { DESC_MAX, TITLE_MAX } from "./seo-score";

/** Product facts Claude may use. Nothing else: it must not invent specifications, warranties or prices. */
export type SeoFacts = {
  name: string; sku?: string | null; brand?: string; categories: string[]; price?: number;
  shortDescription: string; description: string; specification: string; attributes: { name: string; values: string[] }[];
};
export type SeoSuggestion = { focusKeyword: string; seoTitle: string; metaDescription: string; shortDescription?: string; description?: string };

/** target meta description length given to the AI (a little under the 160 Google shows) */
const DESC_MIN_TEXT = "130-155";

export const seoAiAvailable = () => !!process.env.ANTHROPIC_API_KEY;

const Meta = z.object({
  focusKeyword: z.string().describe("2-4 word search phrase, lowercase"),
  seoTitle: z.string(),
  metaDescription: z.string(),
});
const WithCopy = Meta.extend({
  shortDescription: z.string().describe("HTML: one <p> with 1-2 sentences"),
  description: z.string().describe("HTML product description"),
});

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
/** Keep only simple formatting tags, without attributes (this HTML is shown on the storefront) */
export function cleanHtml(html: string) {
  const allowed = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i", "br", "table", "thead", "tbody", "tr", "th", "td"]);
  return html.replace(/<(script|style|iframe|object)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-z0-9]+)[^>]*>/gi, (tag, name: string) => (allowed.has(name.toLowerCase()) ? (tag.startsWith("</") ? `</${name.toLowerCase()}>` : `<${name.toLowerCase()}>`) : ""))
    .trim();
}
/** What to tell staff when the API call fails (the raw API error is logged on the server) */
function friendlyError(e: unknown) {
  console.error("seo ai:", e);
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "The ANTHROPIC_API_KEY on the server isn't valid. Check it in the server's .env.";
  if (e instanceof Anthropic.RateLimitError) return "Too many AI requests at once. Wait a minute and try again.";
  // billing problems come back as a plain 400; only the message says which
  if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) return "Your Anthropic account has no credit left. Add credit at console.anthropic.com → Plans & Billing, then try again.";
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Check the server's internet connection and try again.";
  if (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500) return "The AI service is having problems. Try again in a few minutes.";
  return "The AI suggestion failed. Try again.";
}

/** Cut at a word boundary */
const fit = (s: string, max: number) => { s = s.replace(/\s+/g, " ").trim(); if (s.length <= max) return s; const cut = s.slice(0, max + 1); return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 15)).replace(/[\s,;:–-]+$/, ""); };

/** Writes the focus keyword, SEO title and meta description (and, if asked, the short and long description) for one product */
export async function suggestSeo(f: SeoFacts, opts: { writeCopy?: boolean } = {}): Promise<SeoSuggestion> {
  if (!seoAiAvailable()) throw new Error("Add ANTHROPIC_API_KEY to the server's .env to use AI suggestions.");
  const [site, seo] = await Promise.all([getSite(), getSetting<SeoSettings>("seo")]);
  const model = ASSISTANT_MODELS.some((m) => m.id === seo.aiModel) ? seo.aiModel : "claude-opus-5-5";
  const titleMax = TITLE_MAX - ` – ${site.name}`.length;

  const system = `You write search-engine copy for product pages of ${site.name}, an online store in Zimbabwe (prices in US dollars). Shoppers search Google in English, often adding "Zimbabwe" or "Harare" or "price".

Use only the product facts you are given. Never invent specifications, ratings, warranties, certifications, accessories, stock, delivery times or prices. If the facts are thin, write less rather than guess.

Return:
- focusKeyword: the 2-4 word phrase a shopper would most likely type to find this exact product, lowercase (product type plus its key spec, size or brand, e.g. "5kva petrol generator").
- seoTitle: at most ${titleMax} characters. Start with the focus keyword or a natural variant of it, then the brand or model. Don't add the store name (it is added automatically). No capitals-only words, no emojis, no prices.
- metaDescription: ${DESC_MIN_TEXT} characters. Include the focus keyword once, the main benefit or use, and end with a short call to action such as "Order online from ${site.name}." No prices.${opts.writeCopy ? `
- shortDescription: one <p> with 1-2 plain sentences saying what it is and who it's for.
- description: 250-400 words of HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>. Sections: a short overview paragraph that uses the focus keyword in the first sentence; "Key features" as a list; "Specifications" as a list of the given facts only (skip the section if there are none); "Ideal for" with typical uses. Write for a customer deciding to buy: clear, specific, no hype, no repetition of the keyword more than 3-4 times.` : ""}`;

  const facts = [
    `Name: ${f.name}`, f.sku && `SKU: ${f.sku}`, f.brand && `Brand: ${f.brand}`, f.categories.length && `Categories: ${f.categories.join(", ")}`,
    f.price && `Current price: $${f.price.toFixed(2)} (don't mention it)`,
    strip(f.shortDescription) && `Short description: ${strip(f.shortDescription)}`,
    strip(f.description) && `Description: ${strip(f.description).slice(0, 6000)}`,
    strip(f.specification) && `Specification table: ${strip(f.specification).slice(0, 3000)}`,
    f.attributes.length && `Attributes: ${f.attributes.map((a) => `${a.name}: ${a.values.join(", ")}`).join("; ")}`,
  ].filter(Boolean).join("\n");

  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model, max_tokens: opts.writeCopy ? 8000 : 2000,
    system, messages: [{ role: "user", content: `Product facts:\n${facts}` }],
    output_config: { effort: "low", format: betaZodOutputFormat(opts.writeCopy ? WithCopy : Meta) },
    // a declined request is retried on another model (not available for Haiku)
    ...(model === "claude-haiku-5-5" ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  }).catch((e: unknown) => { throw new Error(friendlyError(e)); });
  if (res.stop_reason === "refusal") throw new Error("The AI declined to write copy for this product.");
  if (res.stop_reason === "max_tokens") throw new Error("The AI's answer was cut off. Try again.");
  const out = res.parsed_output as (z.infer<typeof WithCopy> | z.infer<typeof Meta>) | null;
  if (!out) throw new Error("The AI's answer couldn't be read. Try again.");
  return {
    focusKeyword: fit(out.focusKeyword.toLowerCase(), 80), seoTitle: fit(out.seoTitle, titleMax), metaDescription: fit(out.metaDescription, DESC_MAX),
    ...("description" in out ? { shortDescription: cleanHtml(out.shortDescription), description: cleanHtml(out.description) } : {}),
  };
}
