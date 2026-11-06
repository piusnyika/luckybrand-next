"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { runProductImport } from "@/app/admin/(panel)/products/import/actions";
import type { ImportReport } from "@/lib/admin/product-csv";
import { Badge, Table, th, td } from "./ui";

const ACTION: Record<string, [string, string]> = {
  create: ["New", "bg-green-100 text-green-800"], update: ["Update", "bg-blue-100 text-blue-800"],
  skip: ["Skipped", "bg-gray-100 text-gray-700"], error: ["Error", "bg-red-100 text-red-700"],
};

export function ProductImport() {
  // keep the File in state so "Import now" can resend it after the check
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [moveTables, setMoveTables] = useState(true);
  const [pending, start] = useTransition();

  const run = (mode: "check" | "import") => {
    if (!file) return;
    if (mode === "import" && !window.confirm("Import these products now? Matching products will be updated.")) return;
    const fd = new FormData(); fd.set("file", file); fd.set("mode", mode); if (moveTables) fd.set("moveTables", "1");
    setError("");
    start(async () => {
      const r = await runProductImport(fd);
      if ("error" in r) { setError(r.error); setReport(null); } else setReport(r);
    });
  };
  const rows = report ? (onlyIssues ? report.rows.filter((r) => r.action === "error" || r.action === "skip" || r.notes.length) : report.rows) : [];

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={moveTables} onChange={(e) => { setMoveTables(e.target.checked); setReport(null); }} className="accent-primary" /> Move tables found in descriptions to the Specifications tab</label>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); setError(""); }} />
        <button type="button" disabled={!file || pending} onClick={() => run("check")} className="btn-outline h-10 text-sm">{pending && !report ? "Checking…" : "Check file"}</button>
        {report?.dryRun && report.created + report.updated > 0 && (
          <button type="button" disabled={pending} onClick={() => run("import")} className="btn-primary h-10 text-sm">{pending ? "Importing…" : `Import ${report.created + report.updated} product(s)`}</button>
        )}
      </div>
      {error && <p className="rounded-form border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}
      {report && (
        <>
          <div className={`rounded-form px-4 py-3 text-sm ${report.dryRun ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-900"}`}>
            <strong>{report.dryRun ? "Preview, nothing saved yet:" : "Import finished:"}</strong>{" "}
            {report.created} new, {report.updated} updated, {report.skipped} skipped, {report.errors} with errors.
            {report.imageErrors > 0 && <span className="mt-1 block font-semibold text-danger">{report.imageErrors} image(s) couldn’t be {report.dryRun ? "downloaded" : "downloaded and were left out"}. Tick “Only show rows with errors or notes” to see which and why.</span>}
            {report.dryRun && report.errors > 0 && " Rows with errors will be left out. Fix them in the file and check again, or import the rest."}
            {!report.dryRun && <> <Link href="/admin/products/" className="font-semibold underline">View products</Link></>}
            {report.ignoredColumns.length > 0 && <span className="mt-1 block text-xs">Ignored columns: {report.ignoredColumns.join(", ")}</span>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="accent-primary" /> Only show rows with errors or notes</label>
          <Table head={<><th className={`${th} w-16`}>Row</th><th className={`${th} w-24`}>Result</th><th className={th}>Product</th><th className={th}>Notes</th></>}>
            {rows.map((r) => (
              <tr key={r.line}>
                <td className={`${td} text-ink-muted`}>{r.line}</td>
                <td className={td}><Badge className={ACTION[r.action][1]}>{ACTION[r.action][0]}</Badge></td>
                <td className={`${td} font-medium`}>{r.name}</td>
                <td className={`${td} text-xs ${r.action === "error" ? "text-danger" : "text-ink-soft"}`}>{r.notes.join(" · ")}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}
