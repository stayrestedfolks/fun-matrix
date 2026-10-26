// The rules of the Fun Matrix, kept free of the page so they can be tested: what each round shows,
// how scores and ties work, which professions fit, which safeguards a character gets.

export const MAX_SAFEGUARDS = 4;

export function indexData(data) {
  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const specs = {};
  for (const cls of data.classes) for (const s of cls.specs) specs[s.id] = { ...s, cls };
  return {
    data,
    factions: byId(data.factions),
    races: byId(data.races),
    classes: byId(data.classes),
    specs,
    profs: byId([...data.professions.list, ...data.professions.secondary]),
    pairs: byId(data.professions.pairs),
    sources: data.sources,
  };
}

export const score = (rating) => (rating && rating[0] && rating[1] ? rating[0] + rating[1] : null);

// Fully rated items, in the order given, as {id, x, y, score}.
export function rated(ratings, ids) {
  return ids.filter((id) => score(ratings[id]) !== null).map((id) => ({ id, x: ratings[id][0], y: ratings[id][1], score: score(ratings[id]) }));
}

// The suggestion: every item that shares the best score (more than one means a tie).
export function topIds(list) {
  if (!list.length) return [];
  const best = Math.max(...list.map((i) => i.score));
  return list.filter((i) => i.score === best).map((i) => i.id);
}

// Standard competition ranking: 10, 8, 8, 7 → 1, 2, 2, 4.
export function ranking(list) {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  return sorted.map((item, i) => ({ ...item, rank: sorted.findIndex((o) => o.score === item.score) + 1 }));
}

export const racesFor = (idx, faction) => idx.data.races.filter((r) => r.faction === faction);

// Specs the race can play, grouped by class in the data's class order.
export function specGroupsFor(idx, raceId) {
  const race = idx.races[raceId];
  if (!race) return [];
  return idx.data.classes.filter((c) => race.classes.includes(c.id)).map((c) => ({ cls: c, specs: c.specs }));
}

export function pairFits(pair, cls) {
  if (pair.fit === "all" || !pair.fit) return true;
  return Boolean(pair.fit.armor?.includes(cls.armor) || pair.fit.classes?.includes(cls.id));
}

// Only sensible pairs: the ones that fit the class and the goal ("both" shows every pair that fits).
export function pairsFor(idx, classId, goal) {
  const cls = idx.classes[classId];
  if (!cls || !goal || goal === "later") return [];
  return idx.data.professions.pairs.filter((p) => pairFits(p, cls) && (goal === "both" || p.goals.includes(goal)));
}

export const classOf = (idx, specId) => idx.specs[specId]?.cls ?? null;

// Drops whatever an old or edited link points at that no longer exists or no longer fits.
// Returns the cleaned state plus short notes the page can show.
export function sanitize(st, idx) {
  const notes = [];
  const keep = (ratings, ok) => Object.fromEntries(Object.entries(ratings).filter(([id]) => ok(id)));
  st = { ...st, r: keep(st.r, (id) => idx.races[id]), c: keep(st.c, (id) => idx.specs[id]), p: keep(st.p, (id) => idx.pairs[id]) };
  if (st.rp && !idx.races[st.rp]) st.rp = null;
  if (st.rp && st.f && idx.races[st.rp].faction !== st.f) st.rp = null;
  if (st.rp && !st.f) st.f = idx.races[st.rp].faction;
  if (st.cp && (!idx.specs[st.cp] || !st.rp)) st.cp = null;    // each pick needs the one before it
  if (st.cp && st.rp && !idx.races[st.rp].classes.includes(classOf(idx, st.cp).id)) {
    notes.push(`${idx.races[st.rp].name} can't be a ${classOf(idx, st.cp).name} in Forever, so that pick was cleared.`);
    st.cp = null;
  }
  if (st.pp && (!idx.pairs[st.pp] || !st.cp || !pairsFor(idx, classOf(idx, st.cp).id, st.g).some((p) => p.id === st.pp))) st.pp = null;
  st.s = reachable(st, st.s);
  return { state: st, notes };
}

// The furthest screen this state can show; a link can't jump past a missing pick.
export function reachable(st, wanted) {
  const order = ["welcome", "faction", "race", "class", "goal", "prof", "result"];
  let max = 1;                                  // faction is always open
  if (st.f) max = 2;
  if (st.rp) max = 3;
  if (st.cp) max = 4;
  if (st.cp && st.g) max = st.g === "later" ? 6 : 5;
  if (st.cp && (st.pp || st.g === "later")) max = 6;
  const i = order.indexOf(wanted);
  return i < 0 ? "welcome" : order[Math.min(i, max)];
}

export function flagsFor(idx, st) {
  const flags = new Set();
  const add = (list) => (list || []).forEach((f) => flags.add(f));
  add(idx.races[st.rp]?.flags);
  add(idx.specs[st.cp]?.flags);
  add(idx.pairs[st.pp]?.flags);
  return flags;
}

// Fills {race}, {class}, {spec} and {share} in safeguard text.
export function fill(text, idx, st) {
  const race = idx.races[st.rp], spec = idx.specs[st.cp];
  return String(text)
    .replaceAll("{race}", race?.name ?? "your race")
    .replaceAll("{class}", spec?.cls.name ?? "your class")
    .replaceAll("{spec}", spec ? `${spec.name} ${spec.cls.name}` : "your spec")
    .replaceAll("{share}", race?.census ? `${race.census.share}%` : "a small share");
}

// The safeguards that match this character's rough edges, most important first (data order), at most four.
export function safeguardsFor(idx, st) {
  const flags = flagsFor(idx, st);
  return idx.data.safeguards.filter((g) => flags.has(g.flag)).slice(0, MAX_SAFEGUARDS);
}

export function linksFor(idx, where, st) {
  const cls = classOf(idx, st.cp);
  return idx.data.links.filter((l) => l.where === where).map((l) => ({
    ...l,
    url: l.url.replace("{class}", cls ? cls.name.toLowerCase().replace(/\s+/g, "-") : ""),
    note: fill(l.note, idx, st),
  }));
}
