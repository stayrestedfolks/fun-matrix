// Everything a person chooses lives in the URL after the "#", so a link can be shared and nothing is stored anywhere.
// Format (readable on purpose): #f=h&r=tau.55,orc.32&rp=tau&c=war-prot.55&cp=war-prot&g=both&p=min-bs.45&pp=min-bs&s=result
// A rating "tau.53" means look 5, lore 3; a 0 means that scale isn't rated yet.

export const SCREENS = ["welcome", "faction", "race", "class", "goal", "prof", "result"];
export const GOALS = ["gear", "gold", "both", "later"];
const ID = /^[a-z0-9-]{1,24}$/;

export function emptyState() {
  return { f: null, r: {}, rp: null, c: {}, cp: null, g: null, p: {}, pp: null, s: "welcome" };
}

function encodeRatings(ratings) {
  return Object.entries(ratings)
    .filter(([, [x, y]]) => x || y)
    .map(([id, [x, y]]) => `${id}.${x || 0}${y || 0}`)
    .join(",");
}

function decodeRatings(text) {
  const out = {};
  for (const part of (text || "").split(",")) {
    const m = /^([a-z0-9-]{1,24})\.([0-9])([0-9])$/.exec(part);
    if (!m) continue;
    const clamp = (d) => Math.min(5, Number(d));   // old or hand-edited links can't push a rating past 5
    const [x, y] = [clamp(m[2]), clamp(m[3])];
    if (x || y) out[m[1]] = [x, y];
  }
  return out;
}

export function encode(st) {
  const parts = [];
  const add = (k, v) => v && parts.push(`${k}=${v}`);
  add("f", st.f);
  add("r", encodeRatings(st.r));
  add("rp", st.rp);
  add("c", encodeRatings(st.c));
  add("cp", st.cp);
  add("g", st.g);
  add("p", encodeRatings(st.p));
  add("pp", st.pp);
  if (st.s && st.s !== "welcome") add("s", st.s);
  return parts.join("&");
}

// Never throws: anything it doesn't understand is simply left out.
export function decode(hash) {
  const st = emptyState();
  const text = String(hash || "").replace(/^#/, "");
  for (const pair of text.split("&")) {
    const i = pair.indexOf("=");
    if (i < 1) continue;
    const k = pair.slice(0, i);
    let v;
    try { v = decodeURIComponent(pair.slice(i + 1)); } catch { continue; }
    if (k === "f" && (v === "h" || v === "a")) st.f = v;
    else if (k === "r" || k === "c" || k === "p") st[k] = decodeRatings(v);
    else if ((k === "rp" || k === "cp" || k === "pp") && ID.test(v)) st[k] = v;
    else if (k === "g" && GOALS.includes(v)) st.g = v;
    else if (k === "s" && SCREENS.includes(v)) st.s = v;
  }
  return st;
}
