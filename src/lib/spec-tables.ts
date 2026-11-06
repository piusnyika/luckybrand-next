/*
 * Moves tables out of a product description into its Specifications section. Plain string work, so it runs in the
 * product editor (browser), the bulk tidy-up and the CSV import alike.
 *
 * - a heading/bold line just above a table ("Specifications", "Engine:") goes with it; generic ones are dropped,
 *   because the tab is already called Specifications
 * - WordPress/Google Sheets leftovers (fixed widths, inline styles, data-sheets-*, <colgroup>) are cleaned so the
 *   table fits the screen
 * - a one-cell "table" (a title in a box) isn't a specification: it stays in the description as a paragraph
 * - a table already in the specifications (same text) isn't added twice
 */

export type MoveResult = { description: string; specification: string; moved: number; duplicates: number };

const GENERIC_LABEL = /^(?:technical\s+|product\s+|full\s+|key\s+|general\s+)?(?:spec(?:ification)?s?|specs?\s+sheet|technical\s+(?:data|details|parameters?)|parameters?|details|data|features?\s*(?:and|&)\s*spec(?:ification)?s?)\s*:?$/i;

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const textOf = (html: string) => plain(html).toLowerCase();

/** [start, end) of each top-level <table>…</table>, nesting-aware */
function findTables(html: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /<\/?table\b[^>]*>/gi;
  let depth = 0, start = -1, m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0][1] !== "/") { if (depth++ === 0) start = m.index; }
    else if (depth > 0 && --depth === 0) out.push([start, m.index + m[0].length]);
  }
  return out;
}

/** Strip layout junk so the store's own table styles apply */
export function cleanTable(table: string): string {
  return table
    .replace(/<colgroup\b[\s\S]*?<\/colgroup>/gi, "").replace(/<col\b[^>]*\/?>/gi, "")
    .replace(/<(table|thead|tbody|tfoot|tr|td|th|caption)\b([^>]*)>/gi, (_, tag, attrs: string) => {
      const keep = (attrs.match(/\s(?:colspan|rowspan|scope)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi) ?? []).join("");
      return `<${tag}${keep}>`;
    })
    .replace(/>\s+</g, "><")
    .replace(/<(td|th)>\s*(?:&nbsp;|\s)*<\/\1>/gi, "<$1></$1>");
}

const cellCount = (table: string) => (table.match(/<t[dh]\b/gi) ?? []).length;

export function hasTables(html: string | null | undefined) { return !!html && /<table\b/i.test(html); }

export function moveTablesToSpec(description: string | null | undefined, specification: string | null | undefined): MoveResult {
  let desc = description ?? "";
  let spec = specification ?? "";
  const tables = findTables(desc);
  if (!tables.length) return { description: desc, specification: spec, moved: 0, duplicates: 0 };

  const specText = textOf(spec);
  const pieces: string[] = [];
  let moved = 0, duplicates = 0;

  // work backwards so earlier positions stay valid
  for (let k = tables.length - 1; k >= 0; k--) {
    let [start, end] = tables[k];
    const table = desc.slice(start, end);

    if (cellCount(table) <= 1) {
      const inner = table.replace(/<\/?(?:table|thead|tbody|tfoot|tr|td|th|colgroup|col)\b[^>]*>/gi, "").trim();
      desc = desc.slice(0, start) + (inner ? `<p>${inner}</p>` : "") + desc.slice(end);
      continue;
    }

    // a wrapper that holds only this table (<figure class="wp-block-table">, <div class="table-responsive">) goes too
    const before = desc.slice(0, start), after = desc.slice(end);
    const wrapOpen = before.match(/<(figure|div)\b[^>]*>\s*$/i);
    if (wrapOpen) {
      const close = after.match(new RegExp(`^\\s*(?:<figcaption\\b[\\s\\S]*?<\\/figcaption>\\s*)?<\\/${wrapOpen[1]}>`, "i"));
      if (close) { start -= wrapOpen[0].length; end += close[0].length; }
    }

    // the label line right above the table
    let label = "";
    const lead = desc.slice(0, start).match(
      /(?:<(h[1-6])\b[^>]*>([\s\S]{1,80}?)<\/\1>|<p\b[^>]*>\s*<(strong|b)\b[^>]*>([^<]{1,60})<\/\3>\s*:?\s*<\/p>|(?<=^|[\n>])\s*<(strong|b)\b[^>]*>([^<]{1,60})<\/\5>\s*:?)\s*(?:<br\s*\/?>\s*|&nbsp;\s*)*$/i,
    );
    if (lead) {
      label = plain(lead[2] ?? lead[4] ?? lead[6] ?? "").replace(/:$/, "");
      start -= lead[0].length;
      if (GENERIC_LABEL.test(label)) label = "";
    }

    const clean = cleanTable(table);
    const isDuplicate = specText && specText.includes(textOf(clean));
    if (isDuplicate) duplicates++;
    else { pieces.unshift((label ? `<h4>${label}</h4>` : "") + clean); moved++; }
    desc = desc.slice(0, start) + desc.slice(end);
  }

  desc = desc
    .replace(/<p\b[^>]*>\s*(?:&nbsp;|<br\s*\/?>|\s)*<\/p>/gi, "")
    .replace(/(?:\s*<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?:\s|<br\s*\/?>|&nbsp;)+$/i, "")
    .trim();
  if (pieces.length) spec = (spec.trim() ? spec.trim() + "\n" : "") + pieces.join("\n");
  return { description: desc, specification: spec, moved, duplicates };
}

/** For lists: how many table rows a specification has, and its first rows as "Label: value · Label: value" */
export function specSummary(html: string | null | undefined, previewRows = 3): { rows: number; preview: string; hasText: boolean } {
  const h = html ?? "";
  const trs = h.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  const preview = trs.slice(0, previewRows).map((tr) => (tr.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) => plain(c)).filter(Boolean).join(": ")).filter(Boolean).join(" · ");
  const text = plain(h);
  return { rows: trs.length, preview: preview || text.slice(0, 120), hasText: text.length > 0 };
}
