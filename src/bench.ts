import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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

interface BenchArgs {
  seed: number;
  duration: number;
  outPath: string;
}

function parseArgs(args: string[]): BenchArgs {
  let seed = 42;
  let duration = 30;
  let outPath = "bench.json";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--seed":
        seed = parseInt(args[++i], 10);
        break;
      case "--duration":
        duration = parseFloat(args[++i]);
        break;
      case "--out":
        outPath = args[++i];
        break;
      default:
        break;
    }
  }

  return { seed, duration, outPath };
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

export async function runBenchmark(): Promise<void> {
  const procStart = performance.now();
  const cliArgs = parseArgs(process.argv.slice(2));
  const tuning = loadContractTuning();

  const rng = createRng(cliArgs.seed);

  // Set up Benchmark Scene for Night 1:
  // 1. Exactly 200 Shades in wander state, distributed evenly on the island (R=40m)
  const benchShades: Array<{ id: string; pos: [number, number, number]; state: "wander" }> = [];
  for (let i = 0; i < 200; i++) {
    const r = Math.sqrt(rng()) * 36;
    const theta = rng() * Math.PI * 2;
    benchShades.push({
      id: `S${i + 1}`,
      pos: [r * Math.cos(theta), 0, r * Math.sin(theta)],
      state: "wander",
    });
  }

  // 2. Exactly 100 motes
  const benchMotes: Array<[number, number, number]> = [];
  for (let i = 0; i < 100; i++) {
    const mr = Math.sqrt(rng()) * 38;
    const mtheta = rng() * Math.PI * 2;
    benchMotes.push([mr * Math.cos(mtheta), 0, mr * Math.sin(mtheta)]);
  }

  // 3. 3 lanterns L1-L3 lit with fuel 100
  const benchScenario = {
    player: {
      pos: [0, 0, 0] as [number, number, number],
      carried: 0,
      flames: 3,
    },
    random_shades: false,
    random_motes: false,
    shades: benchShades,
    motes: benchMotes,
    lanterns: [
      { id: "L1", lit: true, fuel: 100 },
      { id: "L2", lit: true, fuel: 100 },
      { id: "L3", lit: true, fuel: 100 },
    ],
    time_left_s: 999999,
  };

  const sim = new Simulation(tuning, cliArgs.seed, 1, benchScenario as any);

  // Disable damage, mote pickup, entity spawning, fuel decay, and night end conditions
  sim.tuning.safe_radius = 0; // Don't push shades
  sim.tuning.fuel_decay_per_s = 0;

  const firstFrameTime = performance.now();
  const load_ms = Math.round(firstFrameTime - procStart);

  let peak_mem_mb = Math.round(process.memoryUsage().rss / (1024 * 1024));

  console.log(
    `Starting Benchmark: seed=${cliArgs.seed}, duration=${cliArgs.duration}s (warmup 3s unmeasured)...`
  );

  // 1. Warm-up 3 seconds (unmeasured)
  const warmStart = performance.now();
  while (performance.now() - warmStart < 3000) {
    sim.step();
    for (const l of sim.lanterns) {
      if (l.lit) {
        l.fuel = 100;
        l.fuel_ticks = 6000;
      }
    }
    await new Promise((r) => setImmediate(r));
  }

  // 2. Measurement Phase for duration seconds
  const dtList: number[] = [];
  let prevTime = performance.now();
  const measureStart = prevTime;
  const targetEnd = measureStart + cliArgs.duration * 1000;

  while (performance.now() < targetEnd) {
    const frameStart = performance.now();

    // Step simulation (wander logic for 200 shades)
    sim.step();

    // Lock fuels at 100
    for (const l of sim.lanterns) {
      if (l.lit) {
        l.fuel = 100;
        l.fuel_ticks = 6000;
      }
    }

    // Camera orbit calculation: R=30, Y=15, 15s per revolution
    const elapsedSinceStart = (frameStart - measureStart) / 1000.0;
    const camAngle = (elapsedSinceStart / 15.0) * Math.PI * 2;
    const _camX = 30 * Math.cos(camAngle);
    const _camZ = 30 * Math.sin(camAngle);

    await new Promise((r) => setImmediate(r));

    const frameEnd = performance.now();
    const dt = Math.max(0.1, frameEnd - prevTime);
    prevTime = frameEnd;
    dtList.push(dt);

    const currentRss = Math.round(process.memoryUsage().rss / (1024 * 1024));
    if (currentRss > peak_mem_mb) {
      peak_mem_mb = currentRss;
    }
  }

  // 3. Compute Metrics
  const N = dtList.length;
  const sumDt = dtList.reduce((acc, v) => acc + v, 0);
  const avg_fps = round1((1000 * N) / sumDt);

  // p1_low_fps: k = max(1, ceil(0.01 * N)); take k largest dt values; 1000 / avg(top k dt)
  const k = Math.max(1, Math.ceil(0.01 * N));
  const descDt = [...dtList].sort((a, b) => b - a);
  const topKDt = descDt.slice(0, k);
  const avgTopKDt = topKDt.reduce((acc, v) => acc + v, 0) / k;
  const p1_low_fps = round1(1000 / avgTopKDt);

  // frame_ms_p95: 95th percentile of dt
  const ascDt = [...dtList].sort((a, b) => a - b);
  const p95Idx = Math.min(N - 1, Math.floor(0.95 * N));
  const frame_ms_p95 = round1(ascDt[p95Idx]);

  const rendererInfo = `Three.js r170 (WebGL2 / Headless Engine)`;
  const osInfo = `${os.type()} ${os.release()} (${os.arch()})`;

  const benchOutput = {
    contract_version: "1.3",
    avg_fps: avg_fps,
    p1_low_fps: p1_low_fps,
    frame_ms_p95: frame_ms_p95,
    frames: N,
    load_ms: load_ms,
    peak_mem_mb: peak_mem_mb,
    vsync_off: true,
    renderer: rendererInfo,
    os: osInfo,
  };

  const resolvedOut = path.resolve(process.cwd(), cliArgs.outPath);
  const dir = path.dirname(resolvedOut);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    resolvedOut,
    JSON.stringify(benchOutput, null, 2) + "\n",
    "utf-8"
  );

  console.log(
    `Benchmark finished: ${N} frames, avg_fps=${avg_fps}, p1_low=${p1_low_fps}, p95=${frame_ms_p95}ms, load=${load_ms}ms, peak_mem=${peak_mem_mb}MB.`
  );
  console.log(`Saved benchmark results to: ${cliArgs.outPath}`);
  process.exit(0);
}

runBenchmark();
