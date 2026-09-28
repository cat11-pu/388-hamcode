import assert from "node:assert";
import { encodeOf, syndromeOf, parityOk, dataOf } from "../ham.js";
import { step, close } from "../hamrun.js";

const emptyState = () => ({
  words: [], decoded: [], fixed: [], drops: [], ledger: [], applied: []
});
const codes = {
  bad_nibble_code: "E_BAD_NIBBLE", bad_pos_code: "E_BAD_POS",
  bad_bit_code: "E_BAD_BIT", no_word_code: "E_NO_WORD",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("encode/syndrome/parity/data round trip for every nibble", () => {
  for (let value = 0; value < 16; value += 1) {
    const word = encodeOf(value);
    assert.ok(Number.isInteger(word) && word >= 0 && word <= 255, "word in 0..255");
    assert.strictEqual(syndromeOf(word), 0, "clean syndrome");
    assert.strictEqual(parityOk(word), true, "clean parity");
    assert.strictEqual(dataOf(word), value, "data round trip");
  }
});

check("step spends budget, leaves the rest on the ledger, close catches up", () => {
  const spec = Object.assign({
    budget: 2, state: emptyState(),
    events: [
      { id: 1, kind: "enc", value: 10 },
      { id: 2, kind: "enc", value: 3 },
      { id: 3, kind: "flip", pos: 1, bit: 3 },
      { id: 4, kind: "dec", pos: 1 }
    ]
  }, codes);
  const first = step(spec);
  assert.strictEqual(first.served, 2);
  assert.strictEqual(first.state.words.length, 2);
  assert.strictEqual(first.ledger_before, 2);
  assert.deepStrictEqual(first.ledger, [["flip", 1, 3], ["dec", 1]]);
  const done = close(Object.assign({}, spec, { state: first.state }));
  assert.strictEqual(done.catchup, 2);
  assert.strictEqual(done.state.ledger.length, 0);
  assert.deepStrictEqual(done.state.decoded, [[1, 10]]);
});

check("single error is corrected, double error is dropped", () => {
  const word = encodeOf(10);
  const single = word ^ (1 << 2);
  assert.strictEqual(syndromeOf(single), 3);
  assert.strictEqual(parityOk(single), false);
  const spec = Object.assign({
    budget: 4, state: { words: [single], decoded: [], fixed: [], drops: [], ledger: [], applied: [] },
    events: [{ id: 1, kind: "dec", pos: 1 }]
  }, codes);
  const first = step(spec);
  assert.deepStrictEqual(first.state.decoded, [[1, 10]]);
  assert.deepStrictEqual(first.state.fixed, [[1, 3]]);

  const double = word ^ (1 << 2) ^ (1 << 4);
  assert.notStrictEqual(syndromeOf(double), 0);
  assert.strictEqual(parityOk(double), true);
  const spec2 = Object.assign({
    budget: 4, state: { words: [double], decoded: [], fixed: [], drops: [], ledger: [], applied: [] },
    events: [{ id: 1, kind: "dec", pos: 1 }]
  }, codes);
  const second = step(spec2);
  assert.deepStrictEqual(second.state.drops, [[1, syndromeOf(double)]]);
  assert.deepStrictEqual(second.state.decoded, []);
});

check("invalid events report the right error codes", () => {
  function probe(event, state, expected) {
    let got = null;
    try {
      step(Object.assign({ budget: 1, state: state || emptyState(), events: [event] }, codes));
    } catch (error) { got = error.code; }
    assert.strictEqual(got, expected);
  }
  probe({ id: 1, kind: "enc", value: 16 }, emptyState(), "E_BAD_NIBBLE");
  probe({ id: 1, kind: "enc", value: -1 }, emptyState(), "E_BAD_NIBBLE");
  probe({ id: 1, kind: "flip", pos: 0, bit: 3 }, emptyState(), "E_BAD_POS");
  probe({ id: 1, kind: "dec", pos: 2 }, { words: [1], decoded: [], fixed: [], drops: [], ledger: [], applied: [] }, "E_NO_WORD");
  probe({ id: 1, kind: "flip", pos: 1, bit: 9 }, { words: [1], decoded: [], fixed: [], drops: [], ledger: [], applied: [] }, "E_BAD_BIT");
  probe({ id: 1, kind: "peek" }, emptyState(), "E_BAD_EVENT");
});

check("replay after close serves nothing new", () => {
  const spec = Object.assign({
    budget: 1, state: emptyState(),
    events: [
      { id: 1, kind: "enc", value: 7 },
      { id: 2, kind: "dec", pos: 1 }
    ]
  }, codes);
  const first = step(spec);
  const done = close(Object.assign({}, spec, { state: first.state }));
  assert.strictEqual(done.state.words.length, 1);
  assert.deepStrictEqual(done.state.decoded, [[1, 7]]);
  const replay = step(Object.assign({}, spec, { state: done.state }));
  assert.strictEqual(replay.served, 0);
  assert.strictEqual(replay.state.ledger.length, 0);
  assert.deepStrictEqual(replay.state.decoded, [[1, 7]]);
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
