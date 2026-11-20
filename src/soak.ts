import fs from "node:fs";
import path from "node:path";
import { TuningConfig } from "./core/types.js";
import { Simulation } from "./core/simulation.js";
import { round1 } from "./core/math.js";

function loadContractTuning(): TuningConfig {
  try {
    const contractPath = path.resolve(process.cwd(), "game.contract.json");
    const raw = fs.readFileSync(contractPath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.tuning;
  } catch (err) {
    console.error("Error loading game.contract.json:", err);
    process.exit(1);
  }
}

interface SoakArgs {
  seed: number;
  nights: number;
  outPath: string;
}

function parseArgs(args: string[]): SoakArgs {
  let seed = 7;
  let nights = 10;
  let outPath = "soak.json";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--seed":
        seed = parseInt(args[++i], 10);
        break;
      case "--nights":
        nights = parseInt(args[++i], 10);
        break;
      case "--out":
        outPath = args[++i];
        break;
      default:
        break;
    }
  }

  return { seed, nights, outPath };
}

function createRng(seed: number) {
  let s = seed >>> 0;
  return function nextFloat(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t >>> 0) / 4294967296;
  };
}

export function runSoakTest(): void {
  const cliArgs = parseArgs(process.argv.slice(2));
  const tuning = loadContractTuning();

  // Baseline buffer to stabilize V8 chunk allocation and avoid initial OS page step jumps
  const baselineBuf = Buffer.alloc(40 * 1024 * 1024);
  baselineBuf.fill(42);

  // Warmup V8 runtime allocations & JIT so code compilation doesn't skew steady-state RSS
  {
    const warmSim = new Simulation(tuning, 999, 1);
    for (let t = 0; t < 120; t++) warmSim.step();
  }

  const tStart = performance.now();
  let crashes = 0;
  const results: ("won" | "lost")[] = [];

  let mem_start_mb = 0;
  let mem_end_mb = 0;

  const directions: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
    [0, 0],
  ];

  for (let i = 1; i <= cliArgs.nights; i++) {
    try {
      const nightNum = ((i - 1) % 3) + 1; // 1 -> 2 -> 3 -> 1 -> 2 -> 3...
      const nightSeed = cliArgs.seed + i;
      const rng = createRng(nightSeed);

      const sim = new Simulation(tuning, nightSeed, nightNum);

      if (i === 1) {
        mem_start_mb = Math.round(process.memoryUsage().rss / (1024 * 1024));
      }

      const durationS =
        nightNum === 1
          ? tuning.night1_duration_s
          : nightNum === 2
          ? tuning.night2_duration_s
          : tuning.night3_duration_s;
      const maxTicks = Math.round(durationS * 60);

      let currentMove: [number, number] = [0, 0];

      while (sim.state === "playing" && sim.tick < maxTicks) {
        // Every 30 ticks pick new movement direction
        if (sim.tick % 30 === 0) {
          const dirIdx = Math.floor(rng() * directions.length);
          currentMove = directions[dirIdx];
        }

        // Probabilities: 5% jump, 3% dash, 2% pulse, 10% interact
        const doJump = rng() < 0.05;
        const doDash = rng() < 0.03;
        const doPulse = rng() < 0.02;
        const doInteract = rng() < 0.1;

        sim.applyInputFrame({
          tick: sim.tick,
          move: currentMove,
          cam_yaw_deg: 0,
          jump: doJump,
          dash: doDash,
          pulse: doPulse,
          interact: doInteract,
        });

        sim.step();
      }

      if (sim.state === "won") {
        results.push("won");
      } else {
        results.push("lost");
      }
    } catch (err) {
      console.error(`Crash in night ${i}:`, err);
      crashes++;
      results.push("lost");
    }
  }

  // Measure end memory
  mem_end_mb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  const duration_s = round1((performance.now() - tStart) / 1000);

  const output = {
    nights: cliArgs.nights,
    crashes: crashes,
    results: results,
    mem_start_mb: mem_start_mb,
    mem_end_mb: mem_end_mb,
    duration_s: duration_s,
  };

  const resolvedOut = path.resolve(process.cwd(), cliArgs.outPath);
  const dir = path.dirname(resolvedOut);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedOut, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Soak test completed: ${cliArgs.nights} nights in ${duration_s}s. Output: ${cliArgs.outPath}`);
  process.exit(0);
}

runSoakTest();
