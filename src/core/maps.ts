import { round3 } from "./math.js";
import { LanternState, CharmState } from "./types.js";

export interface JumpPadConfig {
  pos: [number, number, number];
  radius: number;
  launchVy: number;
  launchVx: number;
  launchVz: number;
}

export interface MapConfig {
  night: number;
  duration_s: number;
  lanterns: LanternState[];
  moteSpawnPoints: [number, number, number][];
  shadeSpawnPoints: [number, number, number][];
  shadeMax: number;
  shadeSpawnIntervalTicks: number;
  shadeSpeed: number;
  charms: CharmState[];
  jumpPads: JumpPadConfig[];
  hasDrifters: boolean;
  hasWind: boolean;
  // Terrain height function for given (x, z)
  // returns ground Y if on land, or -999 if over cloud/fall
  getGroundHeight(x: number, z: number): number;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180.0;
}

// ----------------- NIGHT 1 -----------------
export function getNight1Map(): MapConfig {
  const lanterns: LanternState[] = [
    { id: "L1", pos: [0, 0, 25], lit: false, deposited: 0 },
    { id: "L2", pos: [23.8, 0, 7.7], lit: false, deposited: 0 },
    { id: "L3", pos: [14.7, 0, -20.2], lit: false, deposited: 0 },
    { id: "L4", pos: [-14.7, 0, -20.2], lit: false, deposited: 0 },
    { id: "L5", pos: [-23.8, 0, 7.7], lit: false, deposited: 0 },
  ];

  const moteSpawnPoints: [number, number, number][] = [];
  // 8 points on r=12m (every 45 deg)
  for (let i = 0; i < 8; i++) {
    const rad = degToRad(i * 45);
    moteSpawnPoints.push([round3(12 * Math.cos(rad)), 0, round3(12 * Math.sin(rad))]);
  }
  // 16 points on r=33m (every 22.5 deg)
  for (let i = 0; i < 16; i++) {
    const rad = degToRad(i * 22.5);
    moteSpawnPoints.push([round3(33 * Math.cos(rad)), 0, round3(33 * Math.sin(rad))]);
  }

  // 12 shade spawn points on r=37m (15, 45, ...)
  const shadeSpawnPoints: [number, number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const rad = degToRad(15 + i * 30);
    shadeSpawnPoints.push([round3(37 * Math.cos(rad)), 0, round3(37 * Math.sin(rad))]);
  }

  return {
    night: 1,
    duration_s: 300,
    lanterns,
    moteSpawnPoints,
    shadeSpawnPoints,
    shadeMax: 6,
    shadeSpawnIntervalTicks: 480, // 8s
    shadeSpeed: 4.0,
    charms: [],
    jumpPads: [],
    hasDrifters: false,
    hasWind: false,
    getGroundHeight(x: number, z: number): number {
      const r = Math.sqrt(x * x + z * z);
      return r <= 40.0 ? 0 : -999;
    },
  };
}

// ----------------- NIGHT 2 -----------------
export function getNight2Map(): MapConfig {
  const lanterns: LanternState[] = [
    { id: "L1", pos: [0, 0, 20], lit: false, deposited: 0 },
    { id: "L2", pos: [17, 0, -10], lit: false, deposited: 0 },
    { id: "L3", pos: [-17, 0, -10], lit: false, deposited: 0 },
    { id: "L4", pos: [70, 0, 20], lit: false, deposited: 0 },
    { id: "L5", pos: [87, 0, -10], lit: false, deposited: 0 },
    { id: "L6", pos: [53, 0, -10], lit: false, deposited: 0 },
  ];

  const moteSpawnPoints: [number, number, number][] = [];
  // Island A: (0,0)
  for (let i = 0; i < 4; i++) {
    const rad = degToRad(i * 90);
    moteSpawnPoints.push([round3(10 * Math.cos(rad)), 0, round3(10 * Math.sin(rad))]);
  }
  for (let i = 0; i < 8; i++) {
    const rad = degToRad(i * 45);
    moteSpawnPoints.push([round3(22 * Math.cos(rad)), 0, round3(22 * Math.sin(rad))]);
  }
  // Island B: (70,0)
  for (let i = 0; i < 4; i++) {
    const rad = degToRad(i * 90);
    moteSpawnPoints.push([round3(70 + 10 * Math.cos(rad)), 0, round3(10 * Math.sin(rad))]);
  }
  for (let i = 0; i < 8; i++) {
    const rad = degToRad(i * 45);
    moteSpawnPoints.push([round3(70 + 22 * Math.cos(rad)), 0, round3(22 * Math.sin(rad))]);
  }

  // 8 points r=26m on each island
  const shadeSpawnPoints: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const rad = degToRad(22.5 + i * 45);
    shadeSpawnPoints.push([round3(26 * Math.cos(rad)), 0, round3(26 * Math.sin(rad))]);
    shadeSpawnPoints.push([round3(70 + 26 * Math.cos(rad)), 0, round3(26 * Math.sin(rad))]);
  }

  const charms: CharmState[] = [
    { id: "C1", pos: [35, 0, 0], available: true, respawn_ticks_left: 0 },
  ];

  // Jump pads
  // (20,0,18) -> to center B (70,0,0): dx = 50, dz = -18, len = 53.14 -> dir = [50/len, -18/len] * 24
  const dx1 = 70 - 20;
  const dz1 = 0 - 18;
  const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
  const vx1 = (dx1 / len1) * 24.0;
  const vz1 = (dz1 / len1) * 24.0;

  // (50,0,-18) -> to center A (0,0,0): dx = -50, dz = 18, len = 53.14 -> dir = [-50/len, 18/len] * 24
  const dx2 = 0 - 50;
  const dz2 = 0 - (-18);
  const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
  const vx2 = (dx2 / len2) * 24.0;
  const vz2 = (dz2 / len2) * 24.0;

  const jumpPads: JumpPadConfig[] = [
    {
      pos: [20, 0, 18],
      radius: 1.0,
      launchVy: 14.0,
      launchVx: vx1,
      launchVz: vz1,
    },
    {
      pos: [50, 0, -18],
      radius: 1.0,
      launchVy: 14.0,
      launchVx: vx2,
      launchVz: vz2,
    },
  ];

  return {
    night: 2,
    duration_s: 330,
    lanterns,
    moteSpawnPoints,
    shadeSpawnPoints,
    shadeMax: 8,
    shadeSpawnIntervalTicks: 420, // 7s
    shadeSpeed: 4.0,
    charms,
    jumpPads,
    hasDrifters: true,
    hasWind: false,
    getGroundHeight(x: number, z: number): number {
      // Island A
      const rA = Math.sqrt(x * x + z * z);
      if (rA <= 28.0) return 0;

      // Island B
      const rB = Math.sqrt((x - 70) * (x - 70) + z * z);
      if (rB <= 28.0) return 0;

      // Bamboo bridge x in [26, 44], z in [-2, 2]
      if (x >= 26.0 && x <= 44.0 && z >= -2.0 && z <= 2.0) {
        return 0;
      }

      return -999;
    },
  };
}

// ----------------- NIGHT 3 -----------------
export function getNight3Map(): MapConfig {
  const lanterns: LanternState[] = [
    { id: "L1", pos: [0, 6, 6], lit: false, deposited: 0 },
    { id: "L2", pos: [18, 3, 10], lit: false, deposited: 0 },
    { id: "L3", pos: [-18, 3, 10], lit: false, deposited: 0 },
    { id: "L4", pos: [35, 0, -10], lit: false, deposited: 0 },
    { id: "L5", pos: [-35, 0, -10], lit: false, deposited: 0 },
    { id: "L6", pos: [20, 0, -35], lit: false, deposited: 0 },
    { id: "L7", pos: [-20, 0, -35], lit: false, deposited: 0 },
  ];

  const moteSpawnPoints: [number, number, number][] = [];
  // Tier 0: 18 points r=34m (every 20 deg)
  for (let i = 0; i < 18; i++) {
    const rad = degToRad(i * 20);
    moteSpawnPoints.push([round3(34 * Math.cos(rad)), 0, round3(34 * Math.sin(rad))]);
  }
  // Tier 1: 8 points r=18m (20, 40, ..., 160 deg)
  for (let i = 1; i <= 8; i++) {
    const rad = degToRad(i * 20);
    moteSpawnPoints.push([round3(18 * Math.cos(rad)), 3, round3(18 * Math.sin(rad))]);
  }
  // Tier 2: 4 points r=5m (45, 135, 225, 315 deg)
  for (const deg of [45, 135, 225, 315]) {
    const rad = degToRad(deg);
    moteSpawnPoints.push([round3(5 * Math.cos(rad)), 6, round3(5 * Math.sin(rad))]);
  }

  // 16 shade spawn points r=43m (every 22.5 deg)
  const shadeSpawnPoints: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const rad = degToRad(i * 22.5);
    shadeSpawnPoints.push([round3(43 * Math.cos(rad)), 0, round3(43 * Math.sin(rad))]);
  }

  const charms: CharmState[] = [
    { id: "C1", pos: [30, 0, 25], available: true, respawn_ticks_left: 0 },
    { id: "C2", pos: [-30, 0, 25], available: true, respawn_ticks_left: 0 },
  ];

  // Jump pad at (0, 3, 13) on Tier 1: Vy=12, horizontal V=8 in -Z
  const jumpPads: JumpPadConfig[] = [
    {
      pos: [0, 3, 13],
      radius: 1.0,
      launchVy: 12.0,
      launchVx: 0.0,
      launchVz: -8.0,
    },
  ];

  return {
    night: 3,
    duration_s: 360,
    lanterns,
    moteSpawnPoints,
    shadeSpawnPoints,
    shadeMax: 10,
    shadeSpawnIntervalTicks: 360, // 6s
    shadeSpeed: 4.5,
    charms,
    jumpPads,
    hasDrifters: true,
    hasWind: true,
    getGroundHeight(x: number, z: number): number {
      const r = Math.sqrt(x * x + z * z);
      if (r > 45.0) return -999;

      // Bell tower cylinder r=2m at center: blocked obstacle, cannot climb
      if (r <= 2.0) return 6; // tower is at center of tier 2

      // Tier 2 (Y=6): disc r <= 8m at center
      if (r <= 8.0) return 6;

      // Ramps: 2 straight ramps 3m wide along radius at 30 deg and 150 deg
      // Foot at r=30 (Y=0), top at r=24 (Y=3).
      // Angle theta in [0, 2pi)
      let theta = Math.atan2(z, x);
      if (theta < 0) theta += 2 * Math.PI;

      for (const rampDeg of [30, 150]) {
        const rampRad = degToRad(rampDeg);
        // Distance from ramp center line: |x*sin(rampRad) - z*cos(rampRad)|
        const distFromCenterline = Math.abs(x * Math.sin(rampRad) - z * Math.cos(rampRad));
        if (distFromCenterline <= 1.5 && r >= 24.0 && r <= 30.0) {
          // Linear height: r=30 -> Y=0, r=24 -> Y=3
          const t = (30.0 - r) / (30.0 - 24.0);
          return t * 3.0;
        }
      }

      // Tier 1 (Y=3): ring 12 <= r <= 24 at z > 0
      if (r >= 12.0 && r <= 24.0 && z > 0) {
        return 3;
      }

      // Tier 0 (Y=0)
      return 0;
    },
  };
}
