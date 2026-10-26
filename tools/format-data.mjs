// Rewrites data/forever.json in the house layout: two-space indent, and any short object or list
// (a fact, a source, a list of ids) on a single line, so one fact is one line to read and to diff.
// node tools/format-data.mjs [file]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = process.argv[2] || fileURLToPath(new URL("../data/forever.json", import.meta.url));
const INLINE_MAX = 230;

function fmt(value, indent) {
  const flat = JSON.stringify(value);
  const nested = value && typeof value === "object" && Object.values(value).some((v) => v && typeof v === "object" && Object.keys(v).length);
  if (!value || typeof value !== "object" || (!nested && indent.length + flat.length <= INLINE_MAX)) {
    return flat.replace(/^\{(.+)\}$/s, "{ $1 }").replace(/","/g, '", "').replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\[(.+)\]$/s, "[$1]");
  }
  const inner = indent + "  ";
  if (Array.isArray(value)) return `[\n${value.map((v) => inner + fmt(v, inner)).join(",\n")}\n${indent}]`;
  return `{\n${Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${fmt(v, inner)}`).join(",\n")}\n${indent}}`;
}

const data = JSON.parse(readFileSync(file, "utf8"));
const out = fmt(data, "") + "\n";
if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(data)) throw new Error("formatting changed the data; not writing");
writeFileSync(file, out);
console.log(`Formatted ${file} (${out.split("\n").length} lines)`);
