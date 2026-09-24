export interface SeededRng {
  next: () => number;
  state: () => number;
}
export type RngFactory = (seed: number) => SeededRng;
/** Mulberry32. The complete serialisable state is one unsigned integer. */
export const createRng: RngFactory = (seed) => {
  let value = seed >>> 0;
  return {
    next: () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let result = Math.imul(value ^ (value >>> 15), 1 | value);
      result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    },
    state: () => value,
  };
};
