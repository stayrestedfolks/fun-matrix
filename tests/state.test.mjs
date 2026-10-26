import { test } from "node:test";
import assert from "node:assert/strict";
import { encode, decode, emptyState } from "../js/state.js";

test("a full state survives the round trip", () => {
  const st = { f: "h", r: { tau: [5, 5], orc: [3, 2] }, rp: "tau", c: { "war-prot": [5, 5], "sha-enh": [4, 0] }, cp: "war-prot",
    g: "both", p: { "min-bs": [4, 5] }, pp: "min-bs", s: "result" };
  const hash = encode(st);
  assert.equal(hash, "f=h&r=tau.55,orc.32&rp=tau&c=war-prot.55,sha-enh.40&cp=war-prot&g=both&p=min-bs.45&pp=min-bs&s=result");
  assert.deepEqual(decode("#" + hash), st);
});

test("an empty state encodes to nothing and decodes back", () => {
  assert.equal(encode(emptyState()), "");
  assert.deepEqual(decode(""), emptyState());
  assert.deepEqual(decode("#"), emptyState());
});

test("broken and hostile links decode safely", () => {
  for (const junk of ["#%E0%A4%A", "#f=x&g=lots&s=nowhere", "#r=tau.99,orc..,BAD.55,<script>.11", "#=&&&", "#rp=../../etc", "#" + "a".repeat(5000)]) {
    const st = decode(junk);
    assert.equal(typeof st, "object");
    assert.ok(["welcome"].includes(st.s));
  }
  const st = decode("#r=tau.99,orc..,BAD.55,ok-id.30&rp=../../etc&g=lots");
  assert.deepEqual(st.r, { tau: [5, 5], "ok-id": [3, 0] });   // 9s clamp to 5, junk dropped
  assert.equal(st.rp, null);
  assert.equal(st.g, null);
});

test("unrated pairs (00) are dropped", () => {
  assert.deepEqual(decode("#c=war-arms.00,war-fury.04").c, { "war-fury": [0, 4] });
});
