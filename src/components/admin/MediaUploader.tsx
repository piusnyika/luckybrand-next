"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
export function MediaUploader() {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const router = useRouter();
  return (<>
    <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-primary h-10 text-sm"><Icon name="upload" size={16} />{busy ? "Uploading…" : "Upload files"}</button>
    <input ref={ref} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
      const files = e.target.files; if (!files?.length) return; setBusy(true);
      const fd = new FormData(); [...files].forEach((f) => fd.append("files", f));
      const r = await fetch("/api/admin/media/", { method: "POST", body: fd }); const j = await r.json().catch(() => ({}));
      setBusy(false); e.target.value = "";
      router.push(`/admin/media/?msg=${encodeURIComponent(r.ok ? `${j.items?.length ?? 0} file(s) uploaded` : "Error: " + (j.error || "upload failed"))}`); router.refresh();
    }} />
  </>);
}
