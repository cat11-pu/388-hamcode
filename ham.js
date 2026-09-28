// ham.js：(8,4) 汉明码（SECDED）
// 位置 1..8；数据位在 3/5/6/7（位置 3 是数据最低位），
// 偶校验位在 1/2/4，总校验位在 8。

function bitAt(word, pos) {
  return (word >> (pos - 1)) & 1;
}

export function encodeOf(value) {
  const cells = {};
  cells[3] = value & 1;
  cells[5] = (value >> 1) & 1;
  cells[6] = (value >> 2) & 1;
  cells[7] = (value >> 3) & 1;
  cells[1] = cells[3] ^ cells[5] ^ cells[7];
  cells[2] = cells[3] ^ cells[6] ^ cells[7];
  cells[4] = cells[5] ^ cells[6] ^ cells[7];
  cells[8] = cells[1] ^ cells[2] ^ cells[3] ^ cells[4]
    ^ cells[5] ^ cells[6] ^ cells[7];
  let word = 0;
  for (let pos = 1; pos <= 8; pos += 1) {
    word |= cells[pos] << (pos - 1);
  }
  return word;
}

export function syndromeOf(word) {
  const s1 = bitAt(word, 1) ^ bitAt(word, 3) ^ bitAt(word, 5) ^ bitAt(word, 7);
  const s2 = bitAt(word, 2) ^ bitAt(word, 3) ^ bitAt(word, 6) ^ bitAt(word, 7);
  const s4 = bitAt(word, 4) ^ bitAt(word, 5) ^ bitAt(word, 6) ^ bitAt(word, 7);
  return s1 + s2 * 2 + s4 * 4;
}

export function parityOk(word) {
  let parity = 0;
  for (let pos = 1; pos <= 8; pos += 1) {
    parity ^= bitAt(word, pos);
  }
  return parity === 0;
}

export function dataOf(word) {
  return bitAt(word, 3)
    | (bitAt(word, 5) << 1)
    | (bitAt(word, 6) << 2)
    | (bitAt(word, 7) << 3);
}
