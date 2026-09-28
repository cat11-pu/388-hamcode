// hamrun.js：按处理预算处理事件，用尽后压在账上，收尾把账做完
import { encodeOf, syndromeOf, parityOk, dataOf } from "./ham.js";

function code(spec, key, fallback) {
  return (spec && spec[key]) || fallback;
}

function fail(spec, key, fallback) {
  const error = new Error(fallback);
  error.code = code(spec, key, fallback);
  throw error;
}

function isPosInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function cloneState(state) {
  return {
    words: (state && state.words ? state.words.slice() : []),
    decoded: (state && state.decoded ? state.decoded.map(function (row) { return row.slice(); }) : []),
    fixed: (state && state.fixed ? state.fixed.map(function (row) { return row.slice(); }) : []),
    drops: (state && state.drops ? state.drops.map(function (row) { return row.slice(); }) : []),
    ledger: (state && state.ledger ? state.ledger.map(function (row) { return row.slice(); }) : []),
    applied: (state && state.applied ? state.applied.slice() : [])
  };
}

function tupleOf(event) {
  if (event.kind === "enc") return ["enc", event.value];
  if (event.kind === "flip") return ["flip", event.pos, event.bit];
  return ["dec", event.pos];
}

function alreadyDone(state, event) {
  if (state.applied.indexOf(event.id) !== -1) return true;
  const tuple = tupleOf(event);
  for (const mark of state.applied) {
    if (Array.isArray(mark) && mark.length === tuple.length
        && mark.every(function (part, index) { return part === tuple[index]; })) {
      return true;
    }
  }
  return false;
}

function validate(event, state, spec) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail(spec, "event_error_code", "E_BAD_EVENT");
  }
  if (event.kind === "enc") {
    if (typeof event.value !== "number" || !Number.isInteger(event.value)
        || event.value < 0 || event.value > 15) {
      fail(spec, "bad_nibble_code", "E_BAD_NIBBLE");
    }
    return;
  }
  if (event.kind === "flip") {
    if (!isPosInt(event.pos)) fail(spec, "bad_pos_code", "E_BAD_POS");
    if (!Number.isInteger(event.bit) || event.bit < 1 || event.bit > 8) {
      fail(spec, "bad_bit_code", "E_BAD_BIT");
    }
    if (event.pos > state.words.length) fail(spec, "no_word_code", "E_NO_WORD");
    return;
  }
  if (event.kind === "dec") {
    if (!isPosInt(event.pos)) fail(spec, "bad_pos_code", "E_BAD_POS");
    if (event.pos > state.words.length) fail(spec, "no_word_code", "E_NO_WORD");
    return;
  }
  fail(spec, "event_error_code", "E_BAD_EVENT");
}

function applyRequest(event, state, spec) {
  validate(event, state, spec);
  if (event.kind === "enc") {
    state.words.push(encodeOf(event.value));
  } else if (event.kind === "flip") {
    const index = event.pos - 1;
    state.words[index] = state.words[index] ^ (1 << (event.bit - 1));
  } else {
    const index = event.pos - 1;
    const word = state.words[index];
    const syndrome = syndromeOf(word);
    if (syndrome === 0 && parityOk(word)) {
      state.decoded.push([event.pos, dataOf(word)]);
    } else if (syndrome !== 0 && !parityOk(word)) {
      const repaired = word ^ (1 << (syndrome - 1));
      state.decoded.push([event.pos, dataOf(repaired)]);
      state.fixed.push([event.pos, syndrome]);
    } else if (syndrome !== 0 && parityOk(word)) {
      state.drops.push([event.pos, syndrome]);
    } else {
      state.decoded.push([event.pos, dataOf(word)]);
      state.fixed.push([event.pos, 0]);
    }
  }
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  let budget = Number.isInteger(spec.budget) ? spec.budget : 0;
  let served = 0;
  for (const event of events) {
    if (alreadyDone(state, event)) continue;
    if (served >= budget) {
      state.ledger.push(tupleOf(event));
      continue;
    }
    applyRequest(event, state, spec);
    state.applied.push(event.id);
    served += 1;
  }
  return {
    state,
    served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    judged: served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  const pending = state.ledger;
  state.ledger = [];
  let catchup = 0;
  for (const tuple of pending) {
    const event = tuple[0] === "enc"
      ? { kind: "enc", value: tuple[1] }
      : tuple[0] === "flip"
        ? { kind: "flip", pos: tuple[1], bit: tuple[2] }
        : { kind: "dec", pos: tuple[1] };
    applyRequest(event, state, spec);
    state.applied.push(tuple.slice());
    catchup += 1;
  }
  return { state, catchup };
}
