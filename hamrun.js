// hamrun.js：按处理预算处理事件，用尽的压到账上，收尾把账做完
import { encodeOf, syndromeOf, parityOk, dataOf } from "./ham.js";

function codesOf(spec) {
  const src = spec || {};
  return {
    badEvent: src.event_error_code || "E_BAD_EVENT",
    badNibble: src.bad_nibble_code || "E_BAD_NIBBLE",
    badPos: src.bad_pos_code || "E_BAD_POS",
    badBit: src.bad_bit_code || "E_BAD_BIT",
    noWord: src.no_word_code || "E_NO_WORD"
  };
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const src = state || {};
  return {
    words: (src.words || []).slice(),
    decoded: (src.decoded || []).map(function (row) { return row.slice(); }),
    fixed: (src.fixed || []).map(function (row) { return row.slice(); }),
    drops: (src.drops || []).map(function (row) { return row.slice(); }),
    ledger: (src.ledger || []).slice(),
    applied: (src.applied || []).slice()
  };
}

function keyOf(event, fallback) {
  if (event && typeof event === "object" && event.id !== undefined) {
    return event.id;
  }
  return fallback;
}

function applyEvent(state, event, spec) {
  const codes = codesOf(spec);
  if (!event || typeof event !== "object" || typeof event.kind !== "string") {
    fail(codes.badEvent);
  }
  if (event.kind === "enc") {
    if (!Number.isInteger(event.value) || event.value < 0 || event.value > 15) {
      fail(codes.badNibble);
    }
    state.words.push(encodeOf(event.value));
    return;
  }
  if (event.kind === "flip") {
    if (!Number.isInteger(event.pos) || event.pos < 1) {
      fail(codes.badPos);
    }
    if (!Number.isInteger(event.bit) || event.bit < 1 || event.bit > 8) {
      fail(codes.badBit);
    }
    if (event.pos > state.words.length) {
      fail(codes.noWord);
    }
    state.words[event.pos - 1] ^= (1 << (event.bit - 1));
    return;
  }
  if (event.kind === "dec") {
    if (!Number.isInteger(event.pos) || event.pos < 1) {
      fail(codes.badPos);
    }
    if (event.pos > state.words.length) {
      fail(codes.noWord);
    }
    const word = state.words[event.pos - 1];
    const syndrome = syndromeOf(word);
    const ok = parityOk(word);
    if (syndrome === 0 && ok) {
      state.decoded.push([event.pos, dataOf(word)]);
    } else if (syndrome !== 0 && !ok) {
      const repaired = word ^ (1 << (syndrome - 1));
      state.decoded.push([event.pos, dataOf(repaired)]);
      state.fixed.push([event.pos, syndrome]);
    } else if (syndrome !== 0 && ok) {
      state.drops.push([event.pos, syndrome]);
    } else {
      state.fixed.push([event.pos, 0]);
      state.decoded.push([event.pos, dataOf(word)]);
    }
    return;
  }
  fail(codes.badEvent);
}

function compactOf(event) {
  if (!event || typeof event !== "object") {
    return ["?"];
  }
  if (event.kind === "enc") {
    return ["enc", event.value];
  }
  if (event.kind === "flip") {
    return ["flip", event.pos, event.bit];
  }
  if (event.kind === "dec") {
    return ["dec", event.pos];
  }
  return [event.kind];
}

export function step(spec) {
  const state = cloneState(spec && spec.state);
  const events = (spec && spec.events) || [];
  const budget = spec && Number.isFinite(spec.budget) ? spec.budget : 0;
  let served = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const key = keyOf(event, event);
    if (state.applied.indexOf(key) !== -1) {
      continue;
    }
    if (served < budget) {
      applyEvent(state, event, spec);
      state.applied.push(key);
      served += 1;
    } else {
      state.ledger.push(event);
    }
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(compactOf),
    judged: served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec && spec.state);
  const pending = state.ledger.slice();
  state.ledger = [];
  let catchup = 0;
  for (let index = 0; index < pending.length; index += 1) {
    const event = pending[index];
    const key = keyOf(event, event);
    if (state.applied.indexOf(key) !== -1) {
      continue;
    }
    applyEvent(state, event, spec);
    state.applied.push(key);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
