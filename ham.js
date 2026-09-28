// ham.js：编码、伴随式、总校验与取数据
// 位置 1 到 8：数据位在 3、5、6、7（位置 3 是最低位），偶校验位在 1、2、4，总校验位在 8。
function bitAt(word, pos) {
  return (word >> (pos - 1)) & 1;
}

export function encodeOf(value) {
  const d3 = value & 1;
  const d5 = (value >> 1) & 1;
  const d6 = (value >> 2) & 1;
  const d7 = (value >> 3) & 1;
  const p1 = d3 ^ d5 ^ d7;
  const p2 = d3 ^ d6 ^ d7;
  const p4 = d5 ^ d6 ^ d7;
  const p8 = (p1 + p2 + d3 + p4 + d5 + d6 + d7) & 1;
  return p1 | (p2 << 1) | (d3 << 2) | (p4 << 3) | (d5 << 4) | (d6 << 5) | (d7 << 6) | (p8 << 7);
}

export function syndromeOf(word) {
  const s1 = bitAt(word, 1) ^ bitAt(word, 3) ^ bitAt(word, 5) ^ bitAt(word, 7);
  const s2 = bitAt(word, 2) ^ bitAt(word, 3) ^ bitAt(word, 6) ^ bitAt(word, 7);
  const s4 = bitAt(word, 4) ^ bitAt(word, 5) ^ bitAt(word, 6) ^ bitAt(word, 7);
  return s1 | (s2 << 1) | (s4 << 2);
}

export function parityOk(word) {
  let acc = 0;
  for (let pos = 1; pos <= 8; pos += 1) {
    acc ^= bitAt(word, pos);
  }
  return acc === 0;
}

export function dataOf(word) {
  return bitAt(word, 3) | (bitAt(word, 5) << 1) | (bitAt(word, 6) << 2) | (bitAt(word, 7) << 3);
}
