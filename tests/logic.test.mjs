import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexData, rated, topIds, ranking, racesFor, specGroupsFor, pairsFor, sanitize, reachable, safeguardsFor, fill, linksFor, MAX_SAFEGUARDS } from "../js/logic.js";
import { emptyState } from "../js/state.js";

const data = JSON.parse(readFileSync(new URL("../data/forever.json", import.meta.url), "utf8"));
const idx = indexData(data);
const st = (over) => ({ ...emptyState(), ...over });

test("scores, the suggestion and ties", () => {
  const ratings = { a: [5, 5], b: [4, 4], c: [4, 4], d: [3, 0] };
  const list = rated(ratings, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(list.map((i) => i.id), ["a", "b", "c"]);              // half-rated and unrated stay off the matrix
  assert.deepEqual(topIds(list), ["a"]);
  assert.deepEqual(topIds(rated({ a: [4, 4], b: [5, 3], c: [2, 2] }, ["a", "b", "c"])), ["a", "b"]);   // a two-way tie
  assert.deepEqual(topIds(rated({ a: [3, 3], b: [3, 3], c: [2, 4] }, ["a", "b", "c"])), ["a", "b", "c"]);
  assert.deepEqual(topIds([]), []);
  assert.deepEqual(ranking(list).map((i) => i.rank), [1, 2, 2]);
});

test("each faction has five races, Skyborne on both sides", () => {
  for (const f of ["h", "a"]) {
    const races = racesFor(idx, f);
    assert.equal(races.length, 5);
    assert.ok(races.some((r) => r.name.includes("Skyborne")));
  }
});

test("a Tauren sees exactly the 12 specs of Warrior, Hunter, Shaman and Druid", () => {
  const groups = specGroupsFor(idx, "tau");
  assert.deepEqual(groups.map((g) => g.cls.id).sort(), ["dru", "hun", "sha", "war"]);
  assert.equal(groups.flatMap((g) => g.specs).length, 12);
});

test("the new combos from the official table are there", () => {
  const can = (race, cls) => idx.races[race].classes.includes(cls);
  assert.ok(can("gno", "pri") && can("hum", "hun") && can("dwa", "sha") && can("orc", "mag") && can("tro", "wlk") && can("und", "pal"));
  assert.ok(!can("tau", "pal") && !can("nel", "mag") && !can("skh", "mag") && !can("ska", "sha"));
});

test("professions only offer sensible pairs for the class and goal", () => {
  const ids = (cls, goal) => pairsFor(idx, cls, goal).map((p) => p.id);
  assert.ok(ids("war", "gear").includes("min-bs"));
  assert.ok(!ids("war", "gear").includes("skin-lw"));       // leather for leather and mail wearers
  assert.ok(!ids("mag", "gear").includes("min-bs"));
  assert.ok(ids("mag", "gear").includes("tail-ench"));
  assert.ok(ids("rog", "gear").includes("skin-lw"));
  for (const id of ids("war", "gold")) assert.ok(idx.pairs[id].goals.includes("gold"));
  assert.ok(ids("war", "both").length >= ids("war", "gear").length);
  assert.deepEqual(ids("war", "later"), []);
  for (const p of data.professions.pairs) assert.notEqual(new Set([p.a, p.b]).has("skin") && new Set([p.a, p.b]).has("alc"), true);
});

test("old or edited links are cleaned, never trusted", () => {
  const { state, notes } = sanitize(st({ f: "a", r: { tau: [5, 5], nope: [3, 3] }, rp: "tau", c: { "pal-prot": [5, 5] }, cp: "pal-prot", s: "result" }), idx);
  assert.equal(state.rp, null);                // a Horde race on an Alliance link
  assert.deepEqual(Object.keys(state.r), ["tau"]);
  assert.equal(state.s, "race");                // can't jump past the missing race pick
  const second = sanitize(st({ f: "h", rp: "tau", cp: "pal-prot", s: "result" }), idx);
  assert.equal(second.state.cp, null);          // no Tauren Paladins
  assert.equal(second.notes.length, 1);
});

test("screens open in order", () => {
  assert.equal(reachable(st({}), "result"), "faction");
  assert.equal(reachable(st({ f: "h", rp: "tau", cp: "war-prot", g: "later" }), "result"), "result");
  assert.equal(reachable(st({ f: "h", rp: "tau", cp: "war-prot", g: "both" }), "result"), "prof");
  assert.equal(reachable(st({ f: "h", rp: "tau", cp: "war-prot", g: "both", pp: "min-bs" }), "result"), "result");
  assert.equal(reachable(st({}), "welcome"), "welcome");
});

test("safeguards match the character, at most four", () => {
  const prot = safeguardsFor(idx, st({ f: "h", rp: "tau", cp: "war-prot", g: "both", pp: "min-bs" }));
  assert.ok(prot.length >= 1 && prot.length <= MAX_SAFEGUARDS);
  assert.ok(prot.some((g) => g.flag === "group-heavy"), "a tank should be told to join a guild");
  for (const cls of data.classes) for (const s of cls.specs) {
    const race = data.races.find((r) => r.classes.includes(cls.id));
    assert.ok(safeguardsFor(idx, st({ f: race.faction, rp: race.id, cp: s.id })).length <= MAX_SAFEGUARDS);
  }
});

test("placeholders and links are filled in", () => {
  const s = st({ f: "h", rp: "tau", cp: "war-prot" });
  assert.equal(fill("{race} {spec} {class} {share}", idx, s), `Tauren Protection Warrior Warrior ${idx.races.tau.census.share}%`);
  const talents = linksFor(idx, "result", s).find((l) => l.url.includes("talent-calc"));
  assert.ok(talents.url.endsWith("/talent-calc/warrior"));
});
