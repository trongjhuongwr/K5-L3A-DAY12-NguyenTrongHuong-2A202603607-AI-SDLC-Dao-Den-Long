export class PRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0;
  }

  // Mulberry32 generator, returns [0, 1)
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Range [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer [min, max]
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}
