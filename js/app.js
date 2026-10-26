// The Fun Matrix: screens, events and drawing. The rules live in logic.js, the link format in state.js,
// the 2×2 in matrix.js and the PNG in export.js. Facts come from data/forever.json.
import { renderMatrix, ICON_BASE } from "./matrix.js";
import { encode, decode, emptyState } from "./state.js";
import * as L from "./logic.js";
import { exportPng } from "./export.js";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Plain image requests on purpose: mixing CORS and non-CORS loads of one URL trips the browser cache.
// Only the PNG export asks for CORS, on its own "?fm=1" URLs. "label" gives the fallback disc its letter.
const icon = (name, cls = "icon", alt = "", label = alt) =>
  `<img class="${cls}" src="${ICON_BASE}${esc(name)}.jpg" alt="${esc(alt)}" data-letter="${esc((label || "◆")[0])}">`;

const root = $("#app");
const overlay = $("#overlay");
const phone = matchMedia("(max-width: 760px)");

let idx = null;
let st = emptyState();
const ui = {
  active: {},                      // the item whose facts are showing, per round
  picking: null,                   // a round's key while the person picks a dot by hand
  dialog: null,                    // what the overlay shows, if anything
  prompt: { faction: 0, race: 0, class: 0, prof: 0 },
  land: new Set(),                 // dots that just got both ratings, so they drop in
  coin: null,                      // the faction coin: { side, flipping }
  toast: "",
  startOver: false,
  observers: [],
};

const TAG_SHORT = { dev: "Dev notes", classic: "Classic", community: "Community", ours: "Our read" };
const ROLE = { tank: "Tank", heal: "Healer", melee: "Melee damage", ranged: "Ranged damage" };
const PROF_SHORT = { alc: "Alch", bs: "BS", ench: "Ench", eng: "Eng", herb: "Herb", lw: "LW", min: "Mining", skin: "Skin", tail: "Tailor" };
const GOAL_TEXT = { gear: "their own gear", gold: "gold", both: "a bit of both" };
const GOAL_LABEL = { gear: "For gear", gold: "For gold", both: "For gear and gold", later: "Decide later" };
const LINK_LABEL = { rotation: "Feel the rotation", talents: "Plan your talents", dressing: "Try on gear in 3D", forge: "Character Forge", quiz: "Take a full class quiz" };

// ---------- Small pieces ----------
function date(d) {
  if (!d || d === "n.d.") return "no date";
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function pill(f) {
  const src = idx.sources[f.src] || {};
  const title = `${idx.data.tags[f.tag]} · ${src.name || ""}${src.site ? ` (${src.site})` : ""} · ${date(src.date)}${f.beta ? " · beta, levels 1–30" : ""}`;
  return `<a class="tag ${esc(f.tag)}" href="${esc(src.url || "#")}" target="_blank" rel="noopener" title="${esc(title)}">${TAG_SHORT[f.tag] || f.tag}</a>`;
}
const factText = (f) => `${esc(f.t)}${pill(f)}`;
const factsText = (list) => (list || []).map(factText).join(" ");
const article = (word) => (/^[AEIOU]/i.test(word) ? "An" : "A");
const listOr = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
const roles = (spec) => spec.roles.map((r) => ROLE[r]).join(" · ");
const zone = (start) => (/\(([^)]+)\)/.exec(start)?.[1] ?? start).replace(/,.*$/, "");
const pairName = (p) => `${idx.profs[p.a].name} + ${idx.profs[p.b].name}`;
const pairIcon = (p) => (idx.profs[p.b].kind === "crafting" ? idx.profs[p.b].icon : idx.profs[p.a].icon);
const specName = (spec) => `${spec.name} ${spec.cls.name}`;
const meter = (n) => `<span class="meter">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
const LEVEL = { difficulty: ["", "Gentle", "Moderate", "Demanding"], gear: ["", "Light", "Moderate", "Heavy"] };

// ---------- Saving to the link ----------
// The link people share: never the "?rec" recording switch, only the page and its "#" ratings.
const shareLink = () => location.origin + location.pathname + location.hash;
function save(push) {
  const hash = encode(st);
  const url = hash ? `#${hash}` : location.pathname + location.search;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}
function go(screen) {
  st.s = L.reachable(st, screen);
  ui.picking = null;
  closeDialog(false);
  save(true);
  render();
  window.scrollTo(0, 0);
  $("h1", root)?.focus({ preventScroll: true });
}

// ---------- Rounds ----------
function roundConfig(kind) {
  const axes = {
    race: { x: { name: "Look", lo: "Meh", hi: "Cool", q: "do you like how they look?" }, y: { name: "Lore & racials", short: "Lore", lo: "Boring", hi: "Interesting", q: "do their story and racials grab you?" } },
    class: { x: { name: "Fantasy", lo: "Meh", hi: "That’s me", q: "does it feel like you?" }, y: { name: "Playstyle", lo: "Boring", hi: "Exciting", q: "does it sound fun to play?" } },
    prof: { x: { name: "Worth it", lo: "Frustrating", hi: "Worthwhile", q: "does the payoff feel worth it?" }, y: { name: "The loop", lo: "Tedious", hi: "Satisfying", q: "do you enjoy that loop?" } },
  }[kind];
  if (kind === "race") {
    const f = idx.factions[st.f];
    const races = L.racesFor(idx, st.f);
    return {
      kind, axes, rKey: "r", pKey: "rp", next: "class", back: "faction", backLabel: "faction",
      eyebrow: `Round 1 of 3 · ${f.name}`, title: "Race", noun: "race",
      intro: `${races.length} races on the ${f.name} side. Rate only what tempts you and skip the rest.`,
      quadrants: { tr: "Love it", tl: "Great story", br: "Great look", bl: "Not this time" },
      groups: [{ items: races.map((r) => ({ id: r.id, name: r.name, label: r.name, short: r.name.split(" ")[0], sub: `${r.classes.length} classes · starts in ${zone(r.start)}`, icon: r.icon })) }],
    };
  }
  if (kind === "class") {
    const race = idx.races[st.rp];
    const groups = L.specGroupsFor(idx, st.rp);
    return {
      kind, axes, rKey: "c", pKey: "cp", next: "goal", back: "race", backLabel: "race",
      eyebrow: `Round 2 of 3 · ${race.name}`, title: "Class & spec", noun: "class",
      intro: `${article(race.name)} ${race.name} can be a ${listOr(groups.map((g) => g.cls.name))}. Rate only what tempts you and skip the rest.`,
      quadrants: { tr: "Love it", tl: "Fun to play", br: "Love the idea", bl: "Not this time" },
      groups: groups.map((g) => ({ head: g.cls.name, icon: g.cls.icon, items: g.specs.map((s) => ({ id: s.id, name: `${s.name} ${g.cls.name}`, label: `${s.short} ${g.cls.name}`, short: s.short, sub: roles({ roles: s.roles }), icon: s.icon })) })),
    };
  }
  const spec = idx.specs[st.cp];
  const pairs = L.pairsFor(idx, spec.cls.id, st.g);
  return {
    kind, axes, rKey: "p", pKey: "pp", next: "result", back: "goal", backLabel: "goal",
    eyebrow: `Round 3 of 3 · ${spec.short} ${spec.cls.name}`, title: "Professions", noun: "pair",
    intro: `Pairs that make sense for a ${spec.cls.name} who wants ${GOAL_TEXT[st.g]}.`,
    quadrants: { tr: "Worth it", tl: "Fun loop", br: "Pays off", bl: "Not this time" },
    groups: [{ items: pairs.map((p) => ({ id: p.id, name: pairName(p), label: pairName(p), short: `${PROF_SHORT[p.a]} + ${PROF_SHORT[p.b]}`, sub: GOAL_LABEL[p.goals.length > 1 ? "both" : p.goals[0]], icon: pairIcon(p), icons: [idx.profs[p.a].icon, idx.profs[p.b].icon] })) }],
  };
}
const allItems = (cfg) => cfg.groups.flatMap((g) => g.items);
const ratedList = (cfg) => L.rated(st[cfg.rKey], allItems(cfg).map((i) => i.id));

function activeId(cfg) {
  const items = allItems(cfg);
  const a = ui.active[cfg.kind];
  if (a && items.some((i) => i.id === a)) return a;
  return st[cfg.pKey] && items.some((i) => i.id === st[cfg.pKey]) ? st[cfg.pKey] : items[0]?.id;
}

function scale(cfg, item, axis) {
  const ax = cfg.axes[axis];
  const v = (st[cfg.rKey][item.id] || [0, 0])[axis === "x" ? 0 : 1];
  const pips = [1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="pip${n < v ? " fill" : ""}" role="radio" aria-checked="${n === v}" tabindex="${n === (v || 1) ? 0 : -1}" aria-label="${n}" data-id="${item.id}" data-axis="${axis}" data-v="${n}">${n}</button>`).join("");
  return `<div class="scale" role="radiogroup" aria-label="${esc(item.name)}, ${esc(ax.name)}: 1 ${esc(ax.lo)} to 5 ${esc(ax.hi)}"><span class="axis">${esc(ax.short || ax.name)}</span><span class="lo">${esc(ax.lo)}</span>${pips}<span class="hi">${esc(ax.hi)}</span></div>`;
}

function listHtml(cfg) {
  const top = new Set(L.topIds(ratedList(cfg)));
  const active = activeId(cfg);
  const row = (it) => {
    const s = L.score(st[cfg.rKey][it.id]);
    const icons = it.icons ? `<span class="icon-pair">${it.icons.map((n) => icon(n, "icon", "", it.name)).join("")}</span>` : icon(it.icon, "icon", "", it.name);
    return `<div class="item${it.id === active ? " active" : ""}${s === null ? " unrated" : ""}${st[cfg.pKey] === it.id ? " picked" : ""}" data-row="${it.id}">
      ${icons}
      <button type="button" class="name" data-act="focus" data-id="${it.id}">${esc(it.name)}<small>${esc(it.sub)}</small></button>
      <div class="scales">${scale(cfg, it, "x")}${scale(cfg, it, "y")}</div>
      <div class="total${top.has(it.id) ? " top" : ""}">${s ?? "–"}<small>${s === null ? "skip" : "score"}</small></div>
    </div>`;
  };
  const groups = cfg.groups.map((g) => `<div class="group">${g.head ? `<div class="group-head">${icon(g.icon, "icon", "", g.head)}${esc(g.head)}</div>` : ""}${g.items.map(row).join("")}</div>`).join("");
  const extra = cfg.kind === "prof" ? `<div class="secondary"><div class="section-title">Also worth picking up</div><p class="hint">Anyone can learn these three, on top of two primaries.</p>${idx.data.professions.secondary.map((p) => `<div class="tip">${icon(p.icon, "icon sm")}<p><b>${esc(p.name)}.</b> ${esc(p.tip)}${pill(p)}</p></div>`).join("")}</div>` : "";
  return groups + extra;
}

function boardHtml(cfg) {
  const items = Object.fromEntries(allItems(cfg).map((i) => [i.id, i]));
  const list = L.ranking(ratedList(cfg)).slice(0, 5);
  if (!list.length) return `<p class="empty">Your top scores will show up here.</p>`;
  return `<ol>${list.map((r) => `<li class="${r.rank === 1 ? "top" : ""}"><span class="rank">${r.rank}</span>${icon(items[r.id].icon, "icon", "", items[r.id].label)}<span>${esc(items[r.id].label)}</span><span class="pts">${r.score}</span></li>`).join("")}</ol>`;
}

function progressHtml(cfg) {
  const n = ratedList(cfg).length, total = allItems(cfg).length;
  return `<b>${n}</b> of ${total} rated · skip any you like`;
}

function gutHtml(kind) {
  const list = idx.data.prompts[kind];
  const q = list[ui.prompt[kind] % list.length];
  return `<div class="gut"><div class="seal" aria-hidden="true">?</div><p class="q"><small>Gut check</small>${esc(q)}</p><button type="button" data-act="prompt" data-id="${kind}">↻ Another</button></div>`;
}

function infoHtml(cfg) {
  const id = activeId(cfg);
  if (!id) return "";
  if (cfg.kind === "race") {
    const r = idx.races[id];
    const f = idx.factions[r.faction];
    const classes = r.classes.map((c) => idx.classes[c]).filter(Boolean);
    const dressing = idx.data.links.find((l) => l.id === "dressing");
    return `<div class="info-head wide">${icon(r.icon, "icon", "", r.name)}<div><h2>${esc(r.name)}</h2><div class="chips"><span class="chip ${r.faction === "h" ? "horde" : "alliance"}">${esc(f.name)}</span><span class="chip soft">Starts in ${esc(zone(r.start))}</span><span class="chip soft">Capital: ${esc(r.capital)}</span></div></div></div>
      <p class="fantasy wide">${esc(r.look)}</p>
      <div class="main">
        <ul class="facts"><li><span class="k">Lore</span><span>${esc(r.lore)}</span></li>
        ${r.census ? `<li><span class="k">Players</span><span>${r.census.share}% of beta characters were ${esc(r.name)}.${pill({ tag: "community", src: r.census.src, beta: true })}</span></li>` : ""}
        ${(r.facts || []).map((x) => `<li><span class="k">Good to know</span><span>${factText(x)}</span></li>`).join("")}
        <li><span class="k">Classes</span><span class="class-icons">${classes.map((c) => `<span title="${esc(c.name)}">${icon(c.icon, "icon xs", c.name)}${esc(c.name)}</span>`).join("")}</span></li></ul>
      </div>
      <div class="aside">
        <div class="section-title">Racials</div>
        <ul class="racials">${r.racials.map((x) => `<li>${icon(x.icon || r.icon, "icon sm")}<div><b>${esc(x.name)}</b> <span class="kind">${x.kind}</span><br>${factText(x)}</div></li>`).join("")}</ul>
        ${gutHtml("race")}
        ${dressing ? `<div class="deeper"><a class="ext" href="${esc(dressing.url)}" target="_blank" rel="noopener">See them in 3D <small>${esc(dressing.by)} · pick ${esc(r.name)} there</small></a></div>` : ""}
      </div>`;
  }
  if (cfg.kind === "class") {
    const s = idx.specs[id];
    const rotation = L.linksFor(idx, "class", st).find((l) => l.id === "rotation");
    const talents = idx.data.links.find((l) => l.id === "talents");
    const slug = s.cls.name.toLowerCase();
    return `<div class="info-head wide">${icon(s.icon, "icon", "", s.cls.name)}<div><h2>${esc(specName(s))}</h2><div class="chips">${s.roles.map((r) => `<span class="chip role-${r}">${ROLE[r]}</span>`).join("")}<span class="chip soft">${s.cls.armor[0].toUpperCase() + s.cls.armor.slice(1)}</span></div></div></div>
      <p class="fantasy wide">${esc(s.fantasy)}</p>
      <div class="main">
        <div class="glance">
          <div><div class="k">Difficulty</div><div class="v">${meter(s.facts.difficulty.level)}${LEVEL.difficulty[s.facts.difficulty.level]}</div></div>
          <div><div class="k">Gear needs</div><div class="v">${meter(s.facts.gear.level)}${LEVEL.gear[s.facts.gear.level]}</div></div>
          <div><div class="k">Role</div><div class="v">${esc(roles(s))}</div></div>
        </div>
        <ul class="facts">
          <li><span class="k">Leveling</span><span>${factsText(s.facts.leveling)}</span></li>
          <li><span class="k">Groups</span><span>${factsText(s.facts.group)}</span></li>
          <li><span class="k">PvP</span><span>${factsText(s.facts.pvp)}</span></li>
          <li><span class="k">Difficulty</span><span>${factText(s.facts.difficulty)}</span></li>
          <li><span class="k">Gear</span><span>${factText(s.facts.gear)}</span></li>
        </ul>
      </div>
      <div class="aside">
        <div class="section-title">New in Forever</div>
        <ul class="bullets">${(s.changes || []).map((c) => `<li>${factText(c)}</li>`).join("")}</ul>
        ${gutHtml("class")}
        <div class="deeper">
          ${rotation ? `<a class="ext" href="${esc(rotation.url)}" target="_blank" rel="noopener">Feel the rotation first <small>${esc(rotation.by)}</small></a>` : ""}
          ${talents ? `<a class="ext" href="${esc(talents.url.replace("{class}", slug))}" target="_blank" rel="noopener">Plan your talents <small>${esc(talents.by)}</small></a>` : ""}
        </div>
      </div>`;
  }
  const p = idx.pairs[id];
  const a = idx.profs[p.a], b = idx.profs[p.b];
  return `<div class="info-head wide"><span class="icon-pair big">${icon(a.icon)}${icon(b.icon)}</span><div><h2>${esc(pairName(p))}</h2><div class="chips">${p.goals.map((g) => `<span class="chip soft">${GOAL_LABEL[g]}</span>`).join("")}<span class="chip soft">${a.kind === "gathering" && b.kind === "gathering" ? "Two gatherers" : a.kind === "gathering" ? "Gather + craft" : "Two crafts"}</span></div></div></div>
    <p class="fantasy wide">${esc(p.why)}</p>
    <div class="main"><ul class="facts">
      ${p.facts?.length ? `<li><span class="k">The pair</span><span>${factsText(p.facts)}</span></li>` : ""}
      ${[a, b].map((x) => `<li><span class="k">${esc(x.name)}</span><span>${factsText(x.facts)}</span></li>`).join("")}
    </ul></div>
    <div class="aside">${gutHtml("prof")}</div>`;
}

function roundHtml(kind) {
  const cfg = roundConfig(kind);
  const cta = `<button type="button" class="btn primary" data-act="see-pick"${ratedList(cfg).length ? "" : " disabled"}>See my pick →</button>`;
  return `${topbar(kind)}
    <section class="matrix-row">
      <div class="round-intro wood rivets">
        <button type="button" class="back" data-go="${cfg.back}">← Back to ${cfg.backLabel}</button>
        <div class="eyebrow">${esc(cfg.eyebrow)}</div>
        <h1 class="display" tabindex="-1">${esc(cfg.title)}</h1>
        <p>${esc(cfg.intro)}${kind === "prof" ? ` <button type="button" class="link" data-go="goal">Change goal</button>` : ""}</p>
        <ul class="axis-legend"><li><b>↔ ${esc(cfg.axes.x.name)}</b> · ${esc(cfg.axes.x.q)}</li><li><b>↕ ${esc(cfg.axes.y.name)}</b> · ${esc(cfg.axes.y.q)}</li></ul>
      </div>
      <div class="matrix-panel parchment rivets">
        <svg id="mx-${kind}" role="img" aria-label="Your ${esc(cfg.title)} matrix"></svg>
        ${ui.picking === kind ? `<div class="picking-banner" role="status">Click the dot you want, or the name of any rated ${cfg.noun}. <button type="button" data-act="cancel-pick">Cancel</button></div>` : ""}
      </div>
      <aside class="scoreboard wood rivets" aria-label="Top scores">
        <h2 class="display">Top scores</h2>
        <div id="board">${boardHtml(cfg)}</div>
        <div class="cta"><p class="progress">${progressHtml(cfg)}</p>${cta}</div>
      </aside>
    </section>
    <section class="columns">
      <div class="col ratings parchment rivets">
        <div class="col-head"><h2>Your ratings</h2><p>Two quick gut feelings each, 1 to 5. <button type="button" class="link" data-act="skip" data-id="${kind}">Already know? Pick it →</button></p></div>
        <div id="list">${listHtml(cfg)}</div>
      </div>
      <article class="col info split parchment rivets" id="info" aria-live="polite">${infoHtml(cfg)}</article>
    </section>
    ${fineprint()}
    <footer class="bottombar"><button type="button" class="btn ghost" data-go="${cfg.back}" aria-label="Back to ${cfg.backLabel}">←</button><p class="progress">${progressHtml(cfg)}</p>${cta}</footer>`;
}

// Updates a round in place (keeps scroll position and focus) after a rating or a click.
function refreshRound() {
  const cfg = roundConfig(st.s);
  const focused = document.activeElement?.dataset;
  const keep = focused?.id ? { id: focused.id, axis: focused.axis, act: focused.act } : null;
  $(".columns").append($("#info"));        // on phones it sits inside the list, which is about to be replaced
  $("#list").innerHTML = listHtml(cfg);
  $("#board").innerHTML = boardHtml(cfg);
  $$(".progress").forEach((p) => (p.innerHTML = progressHtml(cfg)));
  $$("[data-act=see-pick]").forEach((b) => (b.disabled = !ratedList(cfg).length));
  const info = $("#info");
  info.innerHTML = infoHtml(cfg);
  placeInfo();
  drawRound(cfg);
  if (keep) {
    const sel = keep.axis ? `.pip[data-id="${keep.id}"][data-axis="${keep.axis}"][tabindex="0"]` : `[data-act="${keep.act}"][data-id="${keep.id}"]`;
    $(sel)?.focus({ preventScroll: true });
  }
}

function drawRound(cfg) {
  const svg = $(`#mx-${cfg.kind}`);
  if (!svg) return;
  const items = Object.fromEntries(allItems(cfg).map((i) => [i.id, i]));
  const list = ratedList(cfg);
  renderMatrix(svg, {
    axes: cfg.axes, quadrants: cfg.quadrants,
    items: list.map((r) => ({ ...r, label: items[r.id].label, short: items[r.id].short, icon: items[r.id].icon })),
    topIds: new Set(L.topIds(list)), activeId: activeId(cfg), chosenId: st[cfg.pKey], landIds: ui.land,
    ghost: "Rate one and watch it land here",
    onPick: (id) => (ui.picking === cfg.kind ? openConfirmOther(cfg, id) : setActive(id)),
    onHover: (id) => $$(".item").forEach((row) => row.classList.toggle("hover", row.dataset.row === id)),
  });
  ui.land.clear();
}

// On phones the facts open right under the item being rated.
function placeInfo() {
  const info = $("#info");
  if (!info) return;
  if (phone.matches) $(`.item[data-row="${CSS.escape(activeId(roundConfig(st.s)))}"]`)?.after(info);
  else if (info.parentNode !== $(".columns")) $(".columns").append(info);
}

function setActive(id) {
  ui.active[st.s] = id;
  refreshRound();
}

function rate(id, axis, v) {
  const cfg = roundConfig(st.s);
  const cur = st[cfg.rKey][id] || [0, 0];
  const wasRated = L.score(cur) !== null;
  const next = axis === "x" ? [v, cur[1]] : [cur[0], v];
  st[cfg.rKey] = { ...st[cfg.rKey], [id]: next };
  if (!wasRated && L.score(next) !== null) ui.land.add(id);
  ui.active[st.s] = id;
  save(false);
  refreshRound();
}

// ---------- Picking the winner ----------
function openSeePick(cfg) {
  const list = ratedList(cfg);
  const tops = L.topIds(list);
  if (!tops.length) return;
  openDialog(tops.length === 1 ? { type: "suggest", kind: cfg.kind, id: tops[0] } : { type: "tie", kind: cfg.kind, ids: tops });
}
function openConfirmOther(cfg, id) {
  if (L.score(st[cfg.rKey][id]) === null) return;
  openDialog({ type: "other", kind: cfg.kind, id });
}

function setPick(kind, id) {
  if (kind === "race") {
    if (st.rp !== id) {
      st.rp = id;
      st.f = idx.races[id].faction;
      if (st.cp && !idx.races[id].classes.includes(L.classOf(idx, st.cp).id)) { st.cp = null; st.pp = null; }
    }
    return go("class");
  }
  if (kind === "class") {
    if (st.cp !== id) {
      st.cp = id;
      if (st.pp && !L.pairsFor(idx, idx.specs[id].cls.id, st.g).some((p) => p.id === st.pp)) st.pp = null;
    }
    return go(st.g && st.g !== "later" && st.pp ? "result" : "goal");
  }
  st.pp = id;
  return go("result");
}

// ---------- Dialogs ----------
function openDialog(d) {
  ui.dialog = d;
  renderDialog();
  overlay.hidden = false;
  requestAnimationFrame(() => $(".dialog button, .dialog a", overlay)?.focus());
}
function closeDialog(restore = true) {
  if (!ui.dialog) return;
  ui.dialog = null;
  overlay.hidden = true;
  overlay.innerHTML = "";
  if (restore) $("[data-act=see-pick]")?.focus({ preventScroll: true });
}

function itemFor(kind, id) {
  if (kind === "race") { const r = idx.races[id]; return { name: r.name, icon: r.icon }; }
  if (kind === "class") { const s = idx.specs[id]; return { name: specName(s), icon: s.icon }; }
  const p = idx.pairs[id]; return { name: pairName(p), icon: pairIcon(p) };
}
const ratingKey = { race: "r", class: "c", prof: "p" };

function coinHtml(face, flipping) {
  return `<div class="coin${flipping ? " flipping" : ""}" aria-hidden="true"><div class="coin-face">${face}</div></div>`;
}

function renderDialog() {
  const d = ui.dialog;
  if (!d) return;
  let body = "";
  if (d.type === "suggest" || d.type === "other") {
    const it = itemFor(d.kind, d.id);
    const s = L.score(st[ratingKey[d.kind]][d.id]);
    const best = Math.max(...ratedList(roundConfig(d.kind)).map((r) => r.score));
    body = d.type === "suggest"
      ? `<div class="eyebrow">Top score</div><div class="pick-line">${icon(it.icon, "icon lg")}<h2>${esc(it.name)} <span>${s}</span></h2></div>
         <p>That's your highest score. Go with ${esc(it.name)}?</p>
         <div class="dialog-actions"><button type="button" class="btn primary" data-act="confirm" data-id="${d.id}">That's the one</button><button type="button" class="btn dark" data-act="pick-other">Pick another dot</button></div>`
      : `<div class="eyebrow">Your call</div><div class="pick-line">${icon(it.icon, "icon lg")}<h2>${esc(it.name)} <span>${s}</span></h2></div>
         <p>${s === best ? "A top score, too." : `The top score is ${best}, but your gut has the last word.`} Go with ${esc(it.name)}?</p>
         <div class="dialog-actions"><button type="button" class="btn primary" data-act="confirm" data-id="${d.id}">Yes, ${esc(it.name)}</button><button type="button" class="btn dark" data-act="pick-other">Back</button></div>`;
  } else if (d.type === "tie") {
    const names = d.ids.map((id) => itemFor(d.kind, id).name);
    const s = L.score(st[ratingKey[d.kind]][d.ids[0]]);
    if (!d.winner) {
      body = `<div class="eyebrow">It's a tie</div><h2>${esc(listAnd(names))}</h2>
        <p>They scored ${s} each. Let a coin decide, then notice how you feel about its answer.</p>
        ${coinHtml("?", d.flipping)}
        <div class="dialog-actions"><button type="button" class="btn primary" data-act="tie-flip"${d.flipping ? " disabled" : ""}>Flip the coin</button><button type="button" class="btn dark" data-act="pick-other">I'll choose myself</button></div>`;
    } else {
      const w = itemFor(d.kind, d.winner);
      const others = d.ids.filter((id) => id !== d.winner);
      body = `<div class="eyebrow">The coin has spoken</div>${coinHtml(icon(w.icon, "icon coin-icon"), false)}
        <h2>${esc(w.name)}</h2>
        <p>Happy, or were you hoping for ${esc(listOr(others.map((id) => itemFor(d.kind, id).name)))}? That feeling is your answer.</p>
        <div class="dialog-actions"><button type="button" class="btn primary" data-act="confirm" data-id="${d.winner}">Keep ${esc(w.name)}</button>
        ${others.length === 1 ? `<button type="button" class="btn dark" data-act="confirm" data-id="${others[0]}">Actually, ${esc(itemFor(d.kind, others[0]).name)}</button>` : `<button type="button" class="btn dark" data-act="pick-other">I'll choose myself</button>`}</div>`;
    }
  } else if (d.type === "picker") {
    body = pickerHtml(d.kind);
  } else if (d.type === "change") {
    body = `<div class="eyebrow">Change a pick</div><h2>Which one?</h2><p>Your ratings stay; you just go back to that round.</p>
      <div class="dialog-list">${[["faction", "Faction"], ["race", "Race"], ["class", "Class & spec"], ["goal", "Professions"]].map(([s, n]) => `<button type="button" class="btn dark" data-go="${s}">${n}</button>`).join("")}</div>`;
  } else if (d.type === "sources") {
    body = sourcesHtml();
  } else if (d.type === "copy") {
    body = `<div class="eyebrow">Your link</div><h2>Copy this link</h2><p>It holds all your ratings; nothing is stored anywhere else.</p><input class="copy-field" readonly value="${esc(shareLink())}"><div class="dialog-actions"><button type="button" class="btn dark" data-act="close">Done</button></div>`;
  }
  overlay.innerHTML = `<div class="dialog parchment rivets${d.type === "sources" || d.type === "picker" ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(d.type)}"><button type="button" class="dialog-x" data-act="close" aria-label="Close">×</button>${body}</div>`;
  if (d.type === "copy") $(".copy-field", overlay)?.select();
}
const listAnd = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

function pickerHtml(kind) {
  const btn = (act, id, ic, name, sub = "") => `<button type="button" class="pick-btn" data-act="${act}" data-id="${id}">${icon(ic, "icon", "", name)}<span>${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ""}</span></button>`;
  if (kind === "start") {
    return `<div class="eyebrow">Skip ahead</div><h2>Which race?</h2><p>Pick it and go straight to class and spec.</p>
      ${idx.data.factions.map((f) => `<div class="picker-group"><div class="group-head">${icon(f.icon)}${esc(f.name)}</div><div class="picker-grid">${L.racesFor(idx, f.id).map((r) => btn("pick-direct", `race:${r.id}`, r.icon, r.name)).join("")}</div></div>`).join("")}`;
  }
  const cfg = roundConfig(kind);
  return `<div class="eyebrow">Already know?</div><h2>Pick your ${esc(cfg.title.toLowerCase())}</h2><p>Straight to the next step. You can always come back and rate.</p>
    ${cfg.groups.map((g) => `<div class="picker-group">${g.head ? `<div class="group-head">${icon(g.icon, "icon", "", g.head)}${esc(g.head)}</div>` : ""}<div class="picker-grid">${g.items.map((it) => btn("pick-direct", `${kind}:${it.id}`, it.icon, it.name, it.sub)).join("")}</div></div>`).join("")}`;
}

function sourcesHtml() {
  const groups = { official: "Blizzard (official)", guide: "Guides and tier lists", census: "Census", forum: "Forums" };
  const all = Object.values(idx.sources);
  const legend = Object.entries(idx.data.tags).map(([k, v]) => `<li><span class="tag ${k}">${TAG_SHORT[k]}</span> ${esc(v)}${k === "community" ? ": guides, tier lists, census and forums. Many are based on the beta, which stopped at level 30." : k === "ours" ? ": Stay Rested's own judgement where no guide rates it yet, based on the cited dev post." : k === "dev" ? ": stated in an official Blizzard post." : ": true in Classic, and nothing official says Forever changed it."}</li>`).join("");
  return `<div class="eyebrow">Facts as of ${date(idx.data.asOf)}</div><h2>Sources</h2>
    <p>Every fact carries a small tag. Hover or tap it to see where it came from.</p><ul class="legend">${legend}</ul>
    ${Object.entries(groups).map(([k, name]) => {
      const list = all.filter((s) => s.kind === k).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return list.length ? `<h3>${name}</h3><ul class="sources">${list.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> <small>${esc(s.site || "")} · ${date(s.date)}</small></li>`).join("")}</ul>` : "";
    }).join("")}
    <p class="hint">Spotted something out of date? Tell us in the comments on the Stay Rested video.</p>`;
}

// ---------- Screens ----------
const STEPS = [["faction", "Faction"], ["race", "Race"], ["class", "Class & spec"], ["prof", "Professions"], ["result", "Result"]];
function topbar(current) {
  const now = current === "goal" ? "prof" : current;
  const done = { faction: !!st.f, race: !!st.rp, class: !!st.cp, prof: !!st.pp || st.g === "later", result: false };
  const steps = STEPS.map(([s, name]) => {
    const target = s === "prof" ? "goal" : s;
    const open = s !== now && L.reachable(st, target) === target;
    const cls = [s === now ? "now" : done[s] ? "done" : ""].join(" ");
    return `<li class="${cls}"${s === now ? ' aria-current="step"' : ""}>${open ? `<button type="button" data-go="${target}">${name}</button>` : name}</li>`;
  }).join("");
  return `<header class="topbar wood rivets">
    <button type="button" class="brand" data-go="welcome"><span class="title display">The Fun <b>Matrix</b></span><span class="by">by Stay Rested</span></button>
    ${current === "welcome" ? "" : `<ol class="steps" aria-label="Progress">${steps}</ol>`}
  </header>`;
}

function fineprint() {
  return `<p class="fineprint">The Fun Matrix is a free fan tool by <a href="https://www.youtube.com/@StayRestedFolks" target="_blank" rel="noopener">Stay Rested</a>. Not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft is a trademark of Blizzard Entertainment, Inc. Icons load from Blizzard's public icon service. · Facts as of ${date(idx.data.asOf)} · <button type="button" class="link" data-act="sources">Sources</button> · No cookies; one anonymous page counter.</p>`;
}

function welcomeHtml() {
  const started = st.f && st.s === "welcome";
  const resume = L.reachable(st, "result");
  const legend = ["dev", "classic", "community", "ours"].filter((k) => idx.data.tags[k]).map((k) => `<span class="tag ${k}">${TAG_SHORT[k]}</span>`).join(" ");
  return `${topbar("welcome")}
    <main class="welcome wood rivets">
      <div class="eyebrow">A free fan tool by Stay Rested · for WoW Forever</div>
      <h1 class="display hero-title" tabindex="-1">The Fun <span>Matrix</span></h1>
      <p class="lede">Stuck choosing a character? Rate each option on two gut feelings, watch it land on the matrix, and let the fun pick for you.</p>
      <ol class="how"><li><b>1</b>Pick a side</li><li><b>2</b>Rate races</li><li><b>3</b>Rate classes and specs</li><li><b>4</b>Rate professions</li></ol>
      <div class="cta-row">
        ${started ? `<button type="button" class="btn primary big" data-go="${resume}">Continue →</button><button type="button" class="btn ghost" data-act="start-over">Start fresh</button>` : `<button type="button" class="btn primary big" data-go="faction">Start →</button>`}
        <button type="button" class="btn ghost" data-act="skip" data-id="start">Already know your race? Skip ahead</button>
      </div>
      <p class="small">About five minutes. Nothing to sign up for: your ratings live only in your link.</p>
      <p class="small asof">Facts as of ${date(idx.data.asOf)}, each tagged by source: ${legend}</p>
    </main>
    ${fineprint()}`;
}

function coinBoxHtml() {
  const c = ui.coin;
  const coinText = c && !c.flipping ? `<p class="coin-result">The coin says <b>${esc(idx.factions[c.side].name)}</b>. Relieved, or a little disappointed? Either way, that feeling is your answer.</p>` : `<p class="coin-result muted">Flip it, and notice which side you're secretly hoping for.</p>`;
  const face = c && !c.flipping ? icon(idx.factions[c.side].icon, "icon coin-icon") : "?";
  return `<div class="eyebrow">Gut check</div>
          <p class="q">${esc(idx.data.prompts.faction[0])}</p>
          ${coinHtml(face, c?.flipping)}
          <button type="button" class="btn dark" data-act="coin-faction"${c?.flipping ? " disabled" : ""}>${c ? "Flip again" : "Flip a coin"}</button>
          ${coinText}`;
}

function factionHtml() {
  const pvp = idx.data.safeguards.find((g) => g.flag === "pvp-faction");
  return `${topbar("faction")}
    <section class="faction-screen">
      <div class="faction-intro wood rivets">
        <button type="button" class="back" data-go="welcome">← Back</button>
        <div class="eyebrow">Before the rounds</div>
        <h1 class="display" tabindex="-1">Pick a side</h1>
        <p>Your faction decides which races you'll rate. The new Skyborne are on both sides.</p>
        <div class="coin-box" aria-live="polite">${coinBoxHtml()}</div>
        ${pvp ? `<p class="note">${esc(pvp.t)}${pvp.facts?.[0] ? pill(pvp.facts[0]) : ""}</p>` : ""}
      </div>
      <div class="faction-cards">
        ${idx.data.factions.map((f) => `<article class="faction-card parchment rivets${st.f === f.id ? " picked" : ""}">
          <div class="faction-head"><div class="banner${f.id === "a" ? " alliance" : ""}">${icon(f.icon, "", f.name)}</div><h2 class="display">${esc(f.name)}</h2></div>
          <ul class="race-chips">${L.racesFor(idx, f.id).map((r) => `<li>${icon(r.icon, "icon sm")}${esc(r.name)}</li>`).join("")}</ul>
          <ul class="bullets">${f.facts.map((x) => `<li>${factText(x)}</li>`).join("")}</ul>
          <button type="button" class="btn primary" data-act="faction" data-id="${f.id}">Choose ${esc(f.name)} →</button>
        </article>`).join("")}
      </div>
    </section>
    ${fineprint()}`;
}

function goalHtml() {
  const spec = idx.specs[st.cp];
  const opt = (id, ic, name, sub) => `<button type="button" class="goal-opt${st.g === id ? " picked" : ""}" data-act="goal" data-id="${id}">${icon(ic, "icon lg")}<b>${name}</b><span>${sub}</span></button>`;
  return `${topbar("goal")}
    <section class="goal-screen">
      <div class="goal-card wood rivets">
        <button type="button" class="back" data-go="class">← Back to class &amp; spec</button>
        <div class="eyebrow">Round 3 of 3 · ${esc(spec.short)} ${esc(spec.cls.name)}</div>
        <h1 class="display" tabindex="-1">What do you want from professions?</h1>
        <p>Every character can learn two primary professions. We'll only show the pairs that make sense for a ${esc(spec.cls.name)}.</p>
        <div class="goal-options">
          ${opt("gear", "inv_hammer_20", "My own gear", "Make what you wear and use")}
          ${opt("gold", "inv_misc_coin_02", "Gold", "Gather and sell")}
          ${opt("both", "inv_misc_bag_10", "A bit of both", "Every pair that fits")}
        </div>
        <button type="button" class="btn ghost" data-act="goal" data-id="later">Decide later</button>
        ${gutHtml("prof")}
        <div class="secondary-row"><div class="eyebrow">Also worth picking up · anyone can learn all three</div>
          ${idx.data.professions.secondary.map((p) => `<div class="tip">${icon(p.icon, "icon sm")}<p><b>${esc(p.name)}.</b> ${esc(p.tip)}${pill(p)}</p></div>`).join("")}</div>
      </div>
    </section>
    ${fineprint()}`;
}

function resultHtml() {
  const race = idx.races[st.rp], spec = idx.specs[st.cp], f = idx.factions[race.faction];
  const pair = st.pp ? idx.pairs[st.pp] : null;
  const tile = (k, icons, v, s) => `<div class="pick"><div class="k">${k}</div><div class="icons">${icons}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`;
  const rr = st.r[st.rp], cr = st.c[st.cp], pr = pair ? st.p[st.pp] : null;
  const scoreLine = (r, a, b) => (L.score(r) !== null ? `${a} ${r[0]} · ${b} ${r[1]} · score ${L.score(r)}` : "Picked straight away");
  const guards = L.safeguardsFor(idx, st);
  const links = [...L.linksFor(idx, "class", st), ...L.linksFor(idx, "result", st)];
  const legacy = idx.data.legacy;
  const mini = (kind, title) => {
    const list = ratedList(roundConfigSafe(kind));
    return list.length ? `<figure class="mini parchment"><h3>${title}</h3><svg id="mini-${kind}" role="img" aria-label="${title} matrix"></svg></figure>`
      : `<figure class="mini parchment empty"><h3>${title}</h3><p>${kind === "prof" && st.g === "later" ? "Deciding later" : "Picked straight away"}</p></figure>`;
  };
  return `${topbar("result")}
    <section class="charcard wood rivets" id="card">
      <div class="sheet">
        <div class="who">
          <div class="banner${race.faction === "a" ? " alliance" : ""}">${icon(f.icon, "", f.name)}</div>
          <div><div class="eyebrow">Your character · ${esc(f.name)}</div>
          <h1 class="display" tabindex="-1">${esc(race.name)} <span>${esc(specName(spec))}</span></h1>
          <div class="sub">${pair ? esc(pairName(pair)) : "Professions: decide later"} · chosen with the Fun Matrix</div></div>
        </div>
        <div class="picks">
          ${tile("Race", icon(race.icon), race.name, scoreLine(rr, "Look", "Lore"))}
          ${tile("Class &amp; spec", icon(spec.icon), specName(spec), cr && L.score(cr) !== null ? `${roles(spec)} · score ${L.score(cr)}` : "Picked straight away")}
          ${pair ? tile("Professions", icon(idx.profs[pair.a].icon) + icon(idx.profs[pair.b].icon), pairName(pair), pr && L.score(pr) !== null ? `${GOAL_LABEL[st.g]} · score ${L.score(pr)}` : "Picked straight away")
            : tile("Professions", icon("inv_misc_questionmark"), "Decide later", "Tips below")}
        </div>
      </div>
      <div class="minis">${mini("race", "Race")}${mini("class", "Class &amp; spec")}${mini("prof", "Professions")}</div>
    </section>
    <section class="lower">
      <div class="safeguards parchment rivets">
        <div class="col-head"><h2>Your safeguards</h2><p>Every character has rough edges. Here's how to smooth these ones.</p></div>
        ${guards.map((g) => `<div class="guard">${icon(guardIcon(g.flag), "gicon")}<div><h3>${esc(g.title)}</h3><p>${esc(L.fill(g.t, idx, st))}</p>${g.facts?.[0] ? `<p class="why">${factText(g.facts[0])}</p>` : ""}</div></div>`).join("")}
        ${!pair ? `<div class="guard">${icon("inv_misc_food_15", "gicon")}<div><h3>Professions can wait</h3><p>${idx.data.professions.secondary.map((p) => `<b>${esc(p.name)}:</b> ${esc(p.tip)}`).join(" ")}</p></div></div>` : ""}
        <div class="whirl">
          <div class="whirl-head">${icon("inv_misc_rune_01")}<h3>${esc(legacy.title)}</h3></div>
          <p>${esc(legacy.t)}${legacy.facts?.[0] ? pill(legacy.facts[0]) : ""}</p>
          ${legacy.facts?.[1] ? `<p class="why">${factText(legacy.facts[1])}</p>` : ""}
        </div>
      </div>
      <div class="side">
        <div class="deeper-card parchment rivets">
          <div class="col-head"><h2>Go deeper</h2><p>Friendly tools by other fans.</p></div>
          ${links.map((l) => `<a class="ext" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(LINK_LABEL[l.id] || l.name)} <small>${esc(l.id === "dressing" ? `${l.by} · pick ${race.name} there` : l.by)}</small></a>`).join("")}
        </div>
        <div class="actions wood rivets">
          <button type="button" class="btn primary" data-act="copy">Copy share link</button>
          <button type="button" class="btn primary" data-act="png">Download PNG</button>
          <button type="button" class="btn ghost" data-act="change">Change a pick</button>
          <button type="button" class="btn ghost" data-act="start-over">${ui.startOver ? "Click again to clear" : "Start over"}</button>
        </div>
      </div>
    </section>
    ${fineprint()}`;
}
const GUARD_ICON = { downtime: "inv_misc_food_15", "group-heavy": "inv_shirt_guildtabard_01", "nerf-fear": "inv_misc_pocketwatch_01", "slow-level": "spell_nature_sleep", hybrid: "spell_holy_borrowedtime", demanding: "inv_misc_spyglass_02", "gold-hungry": "inv_misc_coin_01", rare: null, popular: null, "pvp-faction": "inv_bannerpvp_01" };
const guardIcon = (flag) => GUARD_ICON[flag] || idx.races[st.rp]?.icon || "inv_misc_questionmark";

// Round configs for the result's mini matrices (a skipped round may have no items to show).
function roundConfigSafe(kind) {
  try { return roundConfig(kind); } catch { return { kind, groups: [], rKey: ratingKey[kind], pKey: "" }; }
}

function drawMinis() {
  for (const kind of ["race", "class", "prof"]) {
    const svg = $(`#mini-${kind}`);
    if (!svg) continue;
    const cfg = roundConfig(kind);
    const items = Object.fromEntries(allItems(cfg).map((i) => [i.id, i]));
    renderMatrix(svg, {
      axes: cfg.axes, quadrants: cfg.quadrants, chosenId: st[cfg.pKey],
      items: ratedList(cfg).map((r) => ({ ...r, label: items[r.id].label, short: items[r.id].short, icon: items[r.id].icon })),
    });
  }
}

function render() {
  ui.observers.forEach((o) => o.disconnect());
  ui.observers = [];
  const s = st.s;
  document.body.dataset.screen = s;
  if (s === "welcome") root.innerHTML = welcomeHtml();
  else if (s === "faction") root.innerHTML = factionHtml();
  else if (s === "goal") root.innerHTML = goalHtml();
  else if (s === "result") root.innerHTML = resultHtml();
  else root.innerHTML = roundHtml(s);
  root.className = s === "result" ? "result" : ["race", "class", "prof"].includes(s) ? "app" : "page";
  if (["race", "class", "prof"].includes(s)) {
    placeInfo();
    const panel = $(".matrix-panel");
    const ro = new ResizeObserver(() => drawRound(roundConfig(st.s)));
    ro.observe(panel);
    ui.observers.push(ro);
  }
  if (s === "result") {
    const ro = new ResizeObserver(drawMinis);
    ro.observe($(".minis"));
    ui.observers.push(ro);
  }
  document.title = s === "result" ? `${idx.races[st.rp].name} ${specName(idx.specs[st.cp])} · The Fun Matrix` : "The Fun Matrix · pick your WoW Forever character";
  if (ui.toast) showToast(ui.toast);
}

function showToast(text) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = text;
  t.classList.add("on");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove("on"), 2600);
  ui.toast = "";
}

// ---------- Events ----------
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

async function act(name, id, el) {
  switch (name) {
    case "focus": {
      if (ui.picking === st.s) return openConfirmOther(roundConfig(st.s), id);
      return setActive(id);
    }
    case "prompt": ui.prompt[id]++; return st.s === "goal" ? render() : refreshRound();
    case "see-pick": return openSeePick(roundConfig(st.s));
    case "confirm": { const kind = ui.dialog.kind; closeDialog(false); return setPick(kind, id); }
    case "pick-other": {
      const kind = ui.dialog?.kind || st.s;
      closeDialog(false);
      ui.picking = kind;
      render();
      return;
    }
    case "cancel-pick": ui.picking = null; return render();
    case "tie-flip": {
      const d = ui.dialog;
      d.flipping = true;
      renderDialog();
      setTimeout(() => {
        if (ui.dialog !== d) return;
        d.winner = d.ids[Math.floor(Math.random() * d.ids.length)];
        d.flipping = false;
        renderDialog();
        $(".dialog .btn", overlay)?.focus();
      }, reduceMotion() ? 50 : 1300);
      return;
    }
    case "skip": return openDialog({ type: "picker", kind: id });
    case "pick-direct": {
      const [kind, pid] = id.split(":");
      closeDialog(false);
      return setPick(kind, pid);
    }
    case "coin-faction": {
      ui.coin = { side: Math.random() < 0.5 ? "h" : "a", flipping: true };
      const box = $(".coin-box");
      box.innerHTML = coinBoxHtml();
      setTimeout(() => { ui.coin.flipping = false; box.innerHTML = coinBoxHtml(); $("[data-act=coin-faction]", box)?.focus(); }, reduceMotion() ? 50 : 1300);
      return;
    }
    case "faction": {
      if (st.f !== id) { st.f = id; st.rp = null; st.cp = null; st.pp = null; }
      return go("race");
    }
    case "goal": {
      st.g = id;
      const cls = idx.specs[st.cp].cls.id;
      if (st.pp && !L.pairsFor(idx, cls, id).some((p) => p.id === st.pp)) st.pp = null;
      return go(id === "later" ? "result" : "prof");
    }
    case "copy": {
      try {
        await navigator.clipboard.writeText(shareLink());
        showToast("Link copied. Paste it anywhere to share your matrix.");
      } catch {
        openDialog({ type: "copy" });
      }
      return;
    }
    case "png": {
      el.disabled = true;
      const label = el.textContent;
      el.textContent = "Drawing…";
      try {
        await exportPng(buildCard());
        showToast("PNG saved. Drop it in the comments or on Discord!");
      } catch (e) {
        console.error(e);
        showToast("Sorry, the PNG couldn't be drawn. Try again in a moment.");
      } finally {
        el.disabled = false;
        el.textContent = label;
      }
      return;
    }
    case "change": return openDialog({ type: "change" });
    case "start-over": {
      if (!ui.startOver && st.s === "result") { ui.startOver = true; render(); setTimeout(() => { ui.startOver = false; if (st.s === "result") render(); }, 3500); return; }
      ui.startOver = false;
      st = emptyState();
      ui.active = {};
      ui.coin = null;
      return go("welcome");
    }
    case "sources": return openDialog({ type: "sources" });
    case "close": return closeDialog();
  }
}

// What the PNG shows: the same picks and matrices as the result card.
function buildCard() {
  const race = idx.races[st.rp], spec = idx.specs[st.cp], pair = st.pp ? idx.pairs[st.pp] : null;
  const minis = ["race", "class", "prof"].map((kind) => {
    const cfg = roundConfigSafe(kind);
    const title = { race: "Race", class: "Class & spec", prof: "Professions" }[kind];
    const note = kind === "prof" && st.g === "later" ? "Deciding later" : "Picked straight away";
    if (!cfg.groups.length) return { title, items: [], note };
    const items = Object.fromEntries(allItems(cfg).map((i) => [i.id, i]));
    const list = ratedList(cfg);
    return { title, axes: cfg.axes, quadrants: cfg.quadrants, chosenId: st[cfg.pKey], note: list.length ? "" : note,
      items: list.map((r) => ({ ...r, label: items[r.id].label, short: items[r.id].short, icon: items[r.id].icon })) };
  });
  return {
    faction: idx.factions[race.faction].name, factionId: race.faction, factionIcon: idx.factions[race.faction].icon,
    race: race.name, spec: specName(spec), raceIcon: race.icon, specIcon: spec.icon,
    profs: pair ? pairName(pair) : "Professions: decide later",
    profIcons: pair ? [idx.profs[pair.a].icon, idx.profs[pair.b].icon] : ["inv_misc_questionmark"],
    minis, site: `${location.host}${location.pathname}`.replace(/\/$/, ""),
    file: `fun-matrix-${race.name}-${spec.short}-${spec.cls.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png",
  };
}

root.addEventListener("click", (e) => {
  const pip = e.target.closest(".pip");
  if (pip) return rate(pip.dataset.id, pip.dataset.axis, Number(pip.dataset.v));
  const goEl = e.target.closest("[data-go]");
  if (goEl) return go(goEl.dataset.go);
  const a = e.target.closest("[data-act]");
  if (a) return act(a.dataset.act, a.dataset.id, a);
  const row = e.target.closest(".item[data-row]");
  if (row && !e.target.closest(".scales")) return act("focus", row.dataset.row);
  const board = e.target.closest(".scoreboard li");
  if (board) { const i = $$(".scoreboard li").indexOf(board); const list = L.ranking(ratedList(roundConfig(st.s))); if (list[i]) setActive(list[i].id); }
});
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) return closeDialog();
  const goEl = e.target.closest("[data-go]");
  if (goEl) return go(goEl.dataset.go);
  const a = e.target.closest("[data-act]");
  if (a) act(a.dataset.act, a.dataset.id, a);
});
// Arrow keys move along a 1–5 scale, like any radio group.
root.addEventListener("keydown", (e) => {
  const pip = e.target.closest?.(".pip");
  if (!pip) return;
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const v = Math.min(5, Math.max(1, Number(pip.dataset.v) + step));
  rate(pip.dataset.id, pip.dataset.axis, v);
  $(`.pip[data-id="${pip.dataset.id}"][data-axis="${pip.dataset.axis}"][data-v="${v}"]`)?.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (ui.dialog) closeDialog();
  else if (ui.picking) { ui.picking = null; render(); }
});
// A broken or blocked icon becomes a lettered disc instead of a broken image.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.letter) return;
  const disc = document.createElement("span");
  disc.className = `${img.className} letter`;
  disc.textContent = img.dataset.letter;
  img.replaceWith(disc);
}, true);
phone.addEventListener("change", placeInfo);
window.addEventListener("popstate", () => load());

function load() {
  const { state, notes } = L.sanitize(decode(location.hash), idx);
  st = state;
  ui.picking = null;
  closeDialog(false);
  if (notes.length) ui.toast = notes.join(" ");
  render();
}

// One anonymous, cookie-free page counter (GoatCounter), only once the owner sets their code in index.html.
function startCounter() {
  const code = $('meta[name="fm-goatcounter"]')?.content.trim();
  if (!code || !/^[a-z0-9-]+$/.test(code) || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  document.head.append(s);
}

async function boot() {
  // Recording mode (?rec): keeps the bottom-right quarter free for the host's camera box in Stay Rested videos.
  document.body.classList.toggle("rec", new URLSearchParams(location.search).has("rec"));
  try {
    const res = await fetch("data/forever.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    idx = L.indexData(await res.json());
  } catch (e) {
    root.innerHTML = `<main class="welcome wood rivets"><h1 class="display">The Fun <span>Matrix</span></h1><p class="lede">The facts couldn't load. Please refresh the page.</p></main>`;
    console.error(e);
    return;
  }
  load();
  startCounter();
}
boot();
