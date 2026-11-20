import fs from "node:fs";
import path from "node:path";
import { TuningConfig, ScenarioData, InputsData, InputFrame } from "./core/types.js";
import { Simulation } from "./core/simulation.js";

// Load tuning from game.contract.json
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

interface CliArgs {
  seed: number;
  night: number;
  scenarioPath?: string;
  inputsPath?: string;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
}

function parseArgs(args: string[]): CliArgs {
  let seed = 42;
  let night = 1;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;
  let ticks = 600;
  let outPath = "out.jsonl";
  let snapshotEvery = 10;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--seed":
        seed = parseInt(args[++i], 10);
        break;
      case "--night":
        night = parseInt(args[++i], 10);
        break;
      case "--scenario":
        scenarioPath = args[++i];
        break;
      case "--inputs":
        inputsPath = args[++i];
        break;
      case "--ticks":
        ticks = parseInt(args[++i], 10);
        break;
      case "--out":
        outPath = args[++i];
        break;
      case "--snapshot-every":
        snapshotEvery = parseInt(args[++i], 10);
        break;
      default:
        break;
    }
  }

  return {
    seed,
    night,
    scenarioPath,
    inputsPath,
    ticks,
    outPath,
    snapshotEvery,
  };
}

function loadJsonFile<T>(filePath: string): T {
  try {
    const resolved = path.resolve(process.cwd(), filePath);
    const content = fs.readFileSync(resolved, "utf-8");
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Invalid format or missing file: ${filePath}`, err);
    process.exit(2); // Exit code 2 for malformed inputs/scenario
  }
}

function validateInputs(inputs: InputsData): void {
  if (!inputs || !Array.isArray(inputs.frames)) {
    console.error("Inputs file missing 'frames' array.");
    process.exit(2);
  }

  let prevTick = -1;
  for (const frame of inputs.frames) {
    if (typeof frame.tick !== "number" || frame.tick <= prevTick) {
      console.error(
        `Invalid frame tick ${frame.tick}: must be strictly increasing.`
      );
      process.exit(2);
    }
    prevTick = frame.tick;
  }
}

export function runHeadless(): void {
  const cliArgs = parseArgs(process.argv.slice(2));
  const tuning = loadContractTuning();

  let scenario: ScenarioData | undefined;
  if (cliArgs.scenarioPath) {
    scenario = loadJsonFile<ScenarioData>(cliArgs.scenarioPath);
  }

  let inputs: InputsData | undefined;
  if (cliArgs.inputsPath) {
    inputs = loadJsonFile<InputsData>(cliArgs.inputsPath);
    validateInputs(inputs);
  }

  // Create input map by tick
  const inputMap = new Map<number, InputFrame>();
  if (inputs?.frames) {
    for (const f of inputs.frames) {
      inputMap.set(f.tick, f);
    }
  }

  const sim = new Simulation(tuning, cliArgs.seed, cliArgs.night, scenario);
  const outLines: string[] = [];

  // Snapshot tick 0
  if (cliArgs.snapshotEvery > 0) {
    outLines.push(JSON.stringify(sim.getSnapshot()));
  }

  // Run simulation ticks
  for (let step = 0; step < cliArgs.ticks; step++) {
    // Current step k corresponds to sim.tick (starts at 0)
    const frame = inputMap.get(sim.tick);
    if (frame) {
      sim.applyInputFrame(frame);
    }

    const events = sim.step();

    // Record events
    for (const ev of events) {
      outLines.push(JSON.stringify(ev));
    }

    // Record periodic snapshot
    if (
      cliArgs.snapshotEvery > 0 &&
      sim.tick % cliArgs.snapshotEvery === 0
    ) {
      outLines.push(JSON.stringify(sim.getSnapshot()));
    }

    // Stop if game over
    if (sim.state !== "playing") {
      break;
    }
  }

  // Always write End line
  outLines.push(JSON.stringify(sim.getEndOutput()));

  // Ensure output directory exists
  const resolvedOut = path.resolve(process.cwd(), cliArgs.outPath);
  const dir = path.dirname(resolvedOut);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedOut, outLines.join("\n") + "\n", "utf-8");
  process.exit(0);
}

runHeadless();
