import assert from "node:assert";
import { encodeOf, syndromeOf, parityOk, dataOf } from "../ham.js";
import { step, close } from "../hamrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { words: [], decoded: [], fixed: [], drops: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "enc", value: 10 }],
  bad_nibble_code: "E_BAD_NIBBLE", bad_pos_code: "E_BAD_POS",
  bad_bit_code: "E_BAD_BIT", no_word_code: "E_NO_WORD",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("encodeOf returns a number", () => {
  assert.strictEqual(typeof encodeOf(0), "number");
});

check("syndromeOf returns a number", () => {
  assert.strictEqual(typeof syndromeOf(0), "number");
});

check("parityOk returns a boolean", () => {
  assert.strictEqual(typeof parityOk(0), "boolean");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
