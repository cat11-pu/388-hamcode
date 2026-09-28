// app.js：渲染结果
import { encodeOf, syndromeOf, parityOk, dataOf } from "./ham.js";
import { step, close } from "./hamrun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { events: events, budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      words: state.words, decoded: state.decoded, fixed: state.fixed, drops: state.drops,
      ledger: state.ledger, applied: state.applied.length
    });
  };
  return { words: closed.state.words.slice(),
           decoded: closed.state.decoded.map(function (row) { return [row[0], row[1]]; }),
           fixed: closed.state.fixed.map(function (row) { return [row[0], row[1]]; }),
           drops: closed.state.drops.map(function (row) { return [row[0], row[1]]; }),
           served_first: first.served, served_wide: wide.served,
           pair_differs: first.served !== wide.served,
           ledger_before: first.ledger_before, ledger: first.ledger,
           catchup: closed.catchup, ledger_after: closed.state.ledger.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.served, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count_events: events.length,
           tail: syndromeOf(encodeOf(5)) + (parityOk(encodeOf(5)) ? 1 : 0) + dataOf(encodeOf(5)) };
}
