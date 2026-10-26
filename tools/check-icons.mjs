// Checks that every icon named in the data file (and the few the app uses itself) loads from Blizzard's
// icon service. A missing name comes back as 403. Needs the internet: node tools/check-icons.mjs
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/forever.json", import.meta.url), "utf8"));
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const names = new Map();
(function walk(o, path) {
  if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${path}[${i}]`));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) {
    if (k === "icon" && typeof v === "string") names.set(v, names.get(v) || `${path}${o.id ? ` (${o.id})` : o.name ? ` (${o.name})` : ""}`);
    else walk(v, `${path}.${k}`);
  }
})(data, "data");
for (const m of app.matchAll(/"((?:inv|spell|ability|trade|achievement|racial|classicon)_[a-z0-9_]+)"/g)) if (!names.has(m[1])) names.set(m[1], "js/app.js");

let bad = 0;
await Promise.all([...names].map(async ([name, where]) => {
  const res = await fetch(`https://render.worldofwarcraft.com/us/icons/56/${name}.jpg`, { method: "HEAD" }).catch(() => ({ status: "network error" }));
  if (res.status !== 200) { bad++; console.log(`MISSING ${name} (${res.status}) used at ${where}`); }
}));
console.log(`${names.size - bad} of ${names.size} icons load.`);
process.exitCode = bad ? 1 : 0;
