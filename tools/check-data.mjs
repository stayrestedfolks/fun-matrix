// Checks data/forever.json before anything is published: ids, references, tags, sources, length and tone.
// node tools/check-data.mjs   (exit code 1 if anything is wrong)
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/forever.json", import.meta.url), "utf8"));
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

const TAGS = Object.keys(data.tags);
const ROLES = ["tank", "heal", "melee", "ranged"];
const FLAGS = new Set(data.safeguards.map((g) => g.flag));
const BANNED = /\b(lame|trash|worst|useless|meme|garbage|noob|bad class|terrible|sucks?)\b/i;
const MAX_WORDS = 22;

if (!/^\d{4}-\d{2}-\d{2}$/.test(data.asOf || "")) err("asOf must be a YYYY-MM-DD date");

for (const [key, s] of Object.entries(data.sources)) {
  if (!/^https:\/\//.test(s.url || "")) err(`source ${key}: needs an https url`);
  if (!/^(\d{4}-\d{2}-\d{2}|n\.d\.)$/.test(s.date || "")) err(`source ${key}: date must be YYYY-MM-DD or n.d.`);
  if (!s.name) err(`source ${key}: needs a name`);
}

const ids = new Set();
const uniq = (id, where) => { if (!/^[a-z0-9-]{1,24}$/.test(id)) err(`${where}: bad id "${id}"`); if (ids.has(id)) err(`${where}: duplicate id ${id}`); ids.add(id); };
const used = new Set();
function fact(f, where, { tagged = true } = {}) {
  if (!f || typeof f.t !== "string" || !f.t.trim()) return err(`${where}: empty fact`);
  const words = f.t.trim().split(/\s+/).length;
  if (words > MAX_WORDS) err(`${where}: ${words} words (max ${MAX_WORDS}): "${f.t}"`);
  if (BANNED.test(f.t)) err(`${where}: tone: "${f.t}"`);
  if (/\bu\/[A-Za-z0-9_-]+/.test(f.t)) err(`${where}: looks like a Reddit username`);
  if (!tagged) return;
  if (!TAGS.includes(f.tag)) err(`${where}: tag "${f.tag}" is not one of ${TAGS.join(", ")}`);
  if (!data.sources[f.src]) err(`${where}: unknown source "${f.src}"`);
  used.add(f.src);
}
const facts = (list, where) => (list || []).forEach((f, i) => fact(f, `${where}[${i}]`));
const text = (t, where, max) => {
  if (!t) return err(`${where}: missing`);
  if (BANNED.test(t)) err(`${where}: tone: "${t}"`);
  if (max && t.split(/\s+/).length > max) warn(`${where}: ${t.split(/\s+/).length} words (aim for ${max})`);
};

for (const f of data.factions) { uniq(f.id, "faction"); facts(f.facts, `faction ${f.id}`); }
const classIds = new Set(data.classes.map((c) => c.id));
for (const r of data.races) {
  const w = `race ${r.id}`;
  uniq(r.id, w);
  if (!data.factions.some((f) => f.id === r.faction)) err(`${w}: unknown faction`);
  for (const k of ["name", "icon", "look", "lore", "start", "capital"]) if (!r[k]) err(`${w}: missing ${k}`);
  text(r.look, `${w} look`, 18); text(r.lore, `${w} lore`, 22);
  for (const c of r.classes) if (!classIds.has(c)) err(`${w}: unknown class ${c}`);
  if (r.racials?.length !== 4) err(`${w}: needs 4 racials`);
  (r.racials || []).forEach((x, i) => { fact(x, `${w} racial ${i}`); if (!["active", "passive"].includes(x.kind)) err(`${w} racial ${i}: kind`); });
  if (r.census && !data.sources[r.census.src]) err(`${w}: census source`);
  facts(r.facts, w);
  for (const fl of r.flags || []) if (!FLAGS.has(fl)) err(`${w}: flag ${fl} has no safeguard`);
}
for (const f of ["h", "a"]) if (data.races.filter((r) => r.faction === f).length !== 5) err(`faction ${f}: needs 5 races`);

for (const c of data.classes) {
  const w = `class ${c.id}`;
  uniq(c.id, w);
  if (!["plate", "mail", "leather", "cloth"].includes(c.armor)) err(`${w}: armor`);
  if (c.specs.length !== 3) err(`${w}: needs 3 specs`);
  facts(c.facts, w);
  if (!data.races.some((r) => r.classes.includes(c.id))) err(`${w}: no race can play it`);
  for (const s of c.specs) {
    const ws = `spec ${s.id}`;
    uniq(s.id, ws);
    if (!s.roles?.length || s.roles.some((r) => !ROLES.includes(r))) err(`${ws}: roles`);
    if (!s.short) err(`${ws}: short name`);
    text(s.fantasy, `${ws} fantasy`, 16);
    for (const k of ["leveling", "group", "pvp"]) { if (!s.facts[k]?.length) err(`${ws}: no ${k} facts`); facts(s.facts[k], `${ws} ${k}`); }
    for (const k of ["difficulty", "gear"]) { const x = s.facts[k]; if (![1, 2, 3].includes(x?.level)) err(`${ws}: ${k} level`); fact(x, `${ws} ${k}`); }
    facts(s.changes, `${ws} changes`);
    for (const fl of s.flags || []) if (!FLAGS.has(fl)) err(`${ws}: flag ${fl} has no safeguard`);
  }
}

const profIds = new Set();
for (const p of [...data.professions.list, ...data.professions.secondary]) { uniq(p.id, `profession ${p.id}`); profIds.add(p.id); }
for (const p of data.professions.list) facts(p.facts, `profession ${p.id}`);
for (const p of data.professions.secondary) fact({ t: p.tip, tag: p.tag, src: p.src }, `secondary ${p.id}`);
for (const p of data.professions.pairs) {
  const w = `pair ${p.id}`;
  uniq(p.id, w);
  for (const k of [p.a, p.b]) if (!data.professions.list.some((x) => x.id === k)) err(`${w}: ${k} isn't a primary profession`);
  if (!p.goals?.length || p.goals.some((g) => !["gear", "gold"].includes(g))) err(`${w}: goals`);
  if (p.fit !== "all" && !p.fit?.armor && !p.fit?.classes) err(`${w}: fit`);
  text(p.why, `${w} why`, 18);
  facts(p.facts, w);
  for (const fl of p.flags || []) if (!FLAGS.has(fl)) err(`${w}: flag ${fl} has no safeguard`);
}
for (const g of data.safeguards) { uniq(g.id, `safeguard ${g.id}`); text(g.t, `safeguard ${g.id}`, 32); facts(g.facts, `safeguard ${g.id}`); }
text(data.legacy.t, "legacy", 50); facts(data.legacy.facts, "legacy");
for (const [k, list] of Object.entries(data.prompts)) if (list.length < 3) err(`prompts ${k}: needs at least 3`);
for (const l of data.links) { uniq(l.id, `link ${l.id}`); if (!/^https:\/\//.test(l.url)) err(`link ${l.id}: url`); if (!["class", "result"].includes(l.where)) err(`link ${l.id}: where`); }

for (const key of Object.keys(data.sources)) if (!used.has(key) && !data.races.some((r) => r.census?.src === key) && !data.classes.some((c) => c.census?.src === key)) warn(`source ${key} is never cited`);

for (const w of warnings) console.log("warn:", w);
for (const e of errors) console.log("ERROR:", e);
const count = (o) => (Array.isArray(o) ? o.reduce((n, x) => n + count(x), 0) : o && typeof o === "object" ? (typeof o.t === "string" && o.tag ? 1 : 0) + Object.values(o).reduce((n, x) => n + count(x), 0) : 0);
console.log(`${errors.length ? "FAIL" : "OK"}: ${data.races.length} races, ${data.classes.flatMap((c) => c.specs).length} specs, ${data.professions.pairs.length} pairs, ${count(data)} tagged facts, ${Object.keys(data.sources).length} sources, as of ${data.asOf}. ${errors.length} errors, ${warnings.length} warnings.`);
process.exitCode = errors.length ? 1 : 0;
