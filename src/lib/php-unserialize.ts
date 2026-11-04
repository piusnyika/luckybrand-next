// Minimal PHP unserialize (strings counted in bytes, as PHP does).
export function phpUnserialize(input: string | null | undefined): any {
  if (!input) return null;
  const buf = Buffer.from(input, "utf8");
  let i = 0;
  const readUntil = (ch: string) => { const s = i; while (i < buf.length && buf[i] !== ch.charCodeAt(0)) i++; const out = buf.subarray(s, i).toString("utf8"); i++; return out; };
  const parse = (): any => {
    const type = String.fromCharCode(buf[i]); i += 2; // type + ':' (or ';' for N)
    switch (type) {
      case "N": return null;
      case "b": return readUntil(";") === "1";
      case "i": return parseInt(readUntil(";"), 10);
      case "d": return parseFloat(readUntil(";"));
      case "s": {
        const len = parseInt(readUntil(":"), 10); i++; // opening quote
        const str = buf.subarray(i, i + len).toString("utf8"); i += len + 2; // closing quote + ;
        return str;
      }
      case "a": {
        const n = parseInt(readUntil(":"), 10); i++; // {
        const obj: Record<string, any> = {}; let isList = true;
        for (let k = 0; k < n; k++) { const key = parse(); const val = parse(); if (key !== k) isList = false; obj[key] = val; }
        i++; // }
        return isList ? Object.values(obj) : obj;
      }
      case "O": {
        readUntil(":"); readUntil(":"); // class name len + name
        const n = parseInt(readUntil(":"), 10); i++;
        const obj: Record<string, any> = {};
        for (let k = 0; k < n; k++) { const key = parse(); obj[key] = parse(); }
        i++; return obj;
      }
      default: throw new Error("Unsupported PHP serialize type " + type + " at " + i);
    }
  };
  try { return parse(); } catch { return null; }
}
