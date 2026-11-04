// Builds public/icons.svg from the drawings in src/components/Icon.tsx. Runs before `npm run dev` and `npm run build`.
import { readFileSync, writeFileSync } from "fs";

const source = readFileSync(new URL("../src/components/Icon.tsx", import.meta.url), "utf8");
// JSX to plain SVG: drop fragments, strokeWidth → stroke-width
const toSvg = (jsx) => jsx.replace(/<\/?>/g, "").replace(/\s([a-z]+)([A-Z][a-z]+)=/g, (_, a, b) => ` ${a}-${b.toLowerCase()}=`);
const icons = [...source.matchAll(/^  (\w+): (<.*>),$/gm)].map(([, name, jsx]) => [name, toSvg(jsx)]);
if (icons.length < 40) throw new Error(`Only ${icons.length} icons found in Icon.tsx`);
const bad = icons.find(([, d]) => /[{}]/.test(d));
if (bad) throw new Error(`Icon "${bad[0]}" uses JSX that can't be converted`);

const symbols = icons.map(([name, d]) => `<symbol id="${name}" viewBox="0 0 24 24">${d}</symbol>`).join("");
writeFileSync(new URL("../public/icons.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>\n`);
console.log(`icons.svg: ${icons.length} icons`);
