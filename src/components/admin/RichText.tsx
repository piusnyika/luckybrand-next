"use client";
import { useEffect, useRef, useState } from "react";
import { MediaModal } from "./MediaPicker";

const BTN = "rounded px-2 py-1 text-xs font-semibold hover:bg-white";
/** Lightweight WYSIWYG editor with an HTML source view. Value is posted through a hidden input. */
export function RichText({ name, defaultValue = "", minHeight = 220 }: { name: string; defaultValue?: string | null; minHeight?: number }) {
  const [html, setHtml] = useState(defaultValue || "");
  const [source, setSource] = useState(false);
  const [media, setMedia] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && !source) ref.current.innerHTML = html; }, [source]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmd = (c: string, v?: string) => { ref.current?.focus(); document.execCommand(c, false, v); setHtml(ref.current?.innerHTML || ""); };
  return (
    <div className="overflow-hidden rounded-form border border-line">
      <input type="hidden" name={name} value={html} />
      <div className="flex flex-wrap gap-1 border-b border-line bg-surface p-1.5">
        {!source && <>
          <button type="button" className={BTN} onClick={() => cmd("bold")}><b>B</b></button>
          <button type="button" className={BTN} onClick={() => cmd("italic")}><i>I</i></button>
          <button type="button" className={BTN} onClick={() => cmd("formatBlock", "<h2>")}>H2</button>
          <button type="button" className={BTN} onClick={() => cmd("formatBlock", "<h3>")}>H3</button>
          <button type="button" className={BTN} onClick={() => cmd("formatBlock", "<p>")}>¶</button>
          <button type="button" className={BTN} onClick={() => cmd("insertUnorderedList")}>• List</button>
          <button type="button" className={BTN} onClick={() => cmd("insertOrderedList")}>1. List</button>
          <button type="button" className={BTN} onClick={() => { const u = prompt("Link URL"); if (u) cmd("createLink", u); }}>Link</button>
          <button type="button" className={BTN} onClick={() => setMedia(true)}>Image</button>
          <button type="button" className={BTN} onClick={() => cmd("insertHTML", '<table><tbody><tr><td>Label</td><td>Value</td></tr><tr><td>Label</td><td>Value</td></tr></tbody></table><p></p>')}>Table</button>
          <button type="button" className={BTN} onClick={() => cmd("removeFormat")}>Clear</button>
        </>}
        <button type="button" className={`${BTN} ml-auto`} onClick={() => setSource(!source)}>{source ? "Visual" : "HTML"}</button>
      </div>
      {source ? (
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} className="block w-full p-3 font-mono text-xs outline-none" style={{ minHeight }} />
      ) : (
        <div ref={ref} contentEditable suppressContentEditableWarning onInput={(e) => setHtml((e.target as HTMLDivElement).innerHTML)}
          className="prose-lb max-w-none overflow-auto p-4 text-ink outline-none" style={{ minHeight, maxHeight: 600 }} />
      )}
      <MediaModal open={media} onClose={() => setMedia(false)} onPick={(m) => m[0] && cmd("insertImage", m[0].url)} />
    </div>
  );
}
