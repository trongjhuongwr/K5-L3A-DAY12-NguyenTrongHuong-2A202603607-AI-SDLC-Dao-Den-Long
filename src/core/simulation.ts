import {
  TuningConfig,
  InputFrame,
  ScenarioData,
  PlayerState,
  LanternState,
  ShadeState,
  MoteState,
  SnapshotOutput,
  GameEvent,
  EndOutput,
} from "./types.js";
import {
  round3,
  distXZ,
  normalizeXZ,
  transformMoveInput,
} from "./math.js";
import { PRNG } from "./rng.js";

export class Simulation {
  public tick: number = 0;
  public state: "playing" | "won" | "lost" = "playing";
  public score: number = 0;
  public timeLeftS: number;

  public player: PlayerState;
  public lanterns: LanternState[] = [];
  public shades: ShadeState[] = [];
  public motes: MoteState[] = [];

  public events: GameEvent[] = [];
  public tuning: TuningConfig;
  public rng: PRNG;

  // Previous input state for edge-trigger detection
  private prevInteract: boolean = false;
  private prevPulse: boolean = false;
  private prevJump: boolean = false;

  // Persistent input state
  private currentMove: [number, number] = [0, 0];
  private currentCamYawDeg: number = 0;
  private currentInteract: boolean = false;
  private currentPulse: boolean = false;
  private currentJump: boolean = false;

  private shadeCounter: number = 0;
  private moteCounter: number = 0;

  constructor(
    tuning: TuningConfig,
    seed: number = 42,
    scenario?: ScenarioData
  ) {
    this.tuning = tuning;
    this.rng = new PRNG(seed);
    this.timeLeftS = scenario?.time_left_s ?? tuning.night1_duration_s;

    // Initialize player
    this.player = {
      pos: scenario?.player?.pos ? [...scenario.player.pos] : [0, 0, 0],
      flames: scenario?.player?.flames ?? tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      invuln_timer: 0,
      pulse_cooldown_timer: 0,
    };

    // Initialize 5 default lanterns
    this.initDefaultLanterns();

    // Setup scenario overrides or defaults
    this.setupScenario(scenario);
  }

  private initDefaultLanterns(): void {
    const radius = 22.0;
    this.lanterns = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5;
      const x = round3(radius * Math.sin(angle));
      const z = round3(radius * Math.cos(angle));
      this.lanterns.push({
        id: `L${i + 1}`,
        pos: [x, 0, z],
        lit: false,
        deposited: 0,
      });
    }
  }

  private setupScenario(scenario?: ScenarioData): void {
    // 1. Lantern updates
    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const existing = this.lanterns.find((l) => l.id === override.id);
        if (existing) {
          if (override.pos) existing.pos = [...override.pos];
          if (override.deposited !== undefined) existing.deposited = override.deposited;
          if (override.lit !== undefined) existing.lit = override.lit;
        } else {
          this.lanterns.push({
            id: override.id,
            pos: override.pos ? [...override.pos] : [0, 0, 0],
            deposited: override.deposited ?? 0,
            lit: override.lit ?? false,
          });
        }
      }
    }

    // 2. Motes
    if (scenario?.motes !== undefined) {
      this.motes = scenario.motes.map((pos) => ({
        id: `M${++this.moteCounter}`,
        pos: [round3(pos[0]), round3(pos[1]), round3(pos[2])],
        collected: false,
      }));
    } else if (scenario?.random_motes !== false) {
      // Spawn 20 random motes on island (radius <= 30)
      for (let i = 0; i < 20; i++) {
        const r = this.rng.range(3, 30);
        const theta = this.rng.range(0, 2 * Math.PI);
        const x = round3(r * Math.sin(theta));
        const z = round3(r * Math.cos(theta));
        this.motes.push({
          id: `M${++this.moteCounter}`,
          pos: [x, 0, z],
          collected: false,
        });
      }
    }

    // 3. Shades
    if (scenario?.shades !== undefined) {
      this.shades = scenario.shades.map((s) => ({
        id: s.id || `S${++this.shadeCounter}`,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: "chase",
        stun_timer: 0,
      }));
    } else if (scenario?.random_shades !== false) {
      // Spawn 3 default shades at perimeter (radius ~ 25)
      for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3 + 0.5;
        const x = round3(25 * Math.sin(angle));
        const z = round3(25 * Math.cos(angle));
        this.shades.push({
          id: `S${++this.shadeCounter}`,
          pos: [x, 0, z],
          state: "chase",
          stun_timer: 0,
        });
      }
    }
  }

  public applyInputFrame(frame?: InputFrame): void {
    if (!frame) return;
    if (frame.move !== undefined) {
      this.currentMove = [frame.move[0], frame.move[1]];
    }
    if (frame.cam_yaw_deg !== undefined) {
      this.currentCamYawDeg = frame.cam_yaw_deg;
    }
    if (frame.interact !== undefined) {
      this.currentInteract = frame.interact;
    }
    if (frame.pulse !== undefined) {
      this.currentPulse = frame.pulse;
    }
    if (frame.jump !== undefined) {
      this.currentJump = frame.jump;
    }
  }

  public step(): GameEvent[] {
    if (this.state !== "playing") {
      return [];
    }

    const nextTick = this.tick + 1;
    const stepEvents: GameEvent[] = [];
    const dt = 1.0 / 60.0;

    // Detect rising edges
    const interactTriggered = this.currentInteract && !this.prevInteract;
    const pulseTriggered = this.currentPulse && !this.prevPulse;
    this.prevInteract = this.currentInteract;
    this.prevPulse = this.currentPulse;
    this.prevJump = this.currentJump;

    // Update cooldowns and timers
    if (this.player.invuln_timer > 0) {
      this.player.invuln_timer = Math.max(0, this.player.invuln_timer - dt);
    }
    if (this.player.pulse_cooldown_timer > 0) {
      this.player.pulse_cooldown_timer = Math.max(0, this.player.pulse_cooldown_timer - dt);
    }

    // 1. Player movement
    const [worldDx, worldDz] = transformMoveInput(
      this.currentMove,
      this.currentCamYawDeg
    );
    const speedPerTick = (this.tuning.player_speed * dt);
    let newX = this.player.pos[0] + worldDx * speedPerTick;
    let newZ = this.player.pos[2] + worldDz * speedPerTick;

    // Island boundary check (Island radius = 35m)
    const islandRadius = 35.0;
    const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);
    if (!this.tuning.fall_enabled) {
      if (distFromCenter > islandRadius) {
        const factor = islandRadius / distFromCenter;
        newX *= factor;
        newZ *= factor;
      }
    } else {
      if (distFromCenter > islandRadius) {
        // Player falls off island
        this.player.flames = Math.max(0, this.player.flames - 1);
        stepEvents.push({
          type: "event",
          tick: nextTick,
          name: "player_hit",
          data: { by: "fall", flames: this.player.flames, dropped: 0 },
        });
        // Respawn at center
        newX = 0;
        newZ = 0;
      }
    }
    this.player.pos[0] = round3(newX);
    this.player.pos[2] = round3(newZ);

    // 2. Mote pickup
    for (const mote of this.motes) {
      if (!mote.collected) {
        const d = distXZ(this.player.pos, mote.pos);
        if (d <= this.tuning.pickup_radius) {
          if (this.player.carried < this.tuning.carry_capacity) {
            mote.collected = true;
            this.player.carried++;
            this.score += this.tuning.score.per_mote;
            stepEvents.push({
              type: "event",
              tick: nextTick,
              name: "mote_picked",
              data: { carried: this.player.carried },
            });
          }
        }
      }
    }

    // 3. Lantern deposit (interact rising edge)
    if (interactTriggered) {
      for (const lantern of this.lanterns) {
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= this.tuning.interact_radius && !lantern.lit) {
          if (this.player.carried > 0) {
            const needed = this.tuning.lantern_cost - lantern.deposited;
            const amount = Math.min(this.player.carried, needed);
            if (amount > 0) {
              this.player.carried -= amount;
              lantern.deposited += amount;
              stepEvents.push({
                type: "event",
                tick: nextTick,
                name: "deposit",
                data: {
                  lantern_id: lantern.id,
                  amount: amount,
                  deposited: lantern.deposited,
                },
              });

              if (lantern.deposited >= this.tuning.lantern_cost) {
                lantern.lit = true;
                this.score += this.tuning.score.per_lantern;
                stepEvents.push({
                  type: "event",
                  tick: nextTick,
                  name: "lantern_lit",
                  data: { lantern_id: lantern.id },
                });
              }
            }
          }
          break; // interact with the closest matching lantern
        }
      }
    }

    // 4. Pulse action
    if (pulseTriggered) {
      if (
        this.player.carried >= this.tuning.pulse_cost &&
        this.player.pulse_cooldown_timer <= 0
      ) {
        this.player.carried -= this.tuning.pulse_cost;
        this.player.pulse_cooldown_timer = this.tuning.pulse_cooldown_s;

        const stunnedIds: string[] = [];
        for (const shade of this.shades) {
          const d = distXZ(this.player.pos, shade.pos);
          if (d <= this.tuning.pulse_radius) {
            shade.state = "stunned";
            shade.stun_timer = this.tuning.pulse_stun_s;
            stunnedIds.push(shade.id);
            this.score += this.tuning.score.per_stun;

            // Push away along XZ
            const [pdx, pdz] = normalizeXZ(
              shade.pos[0] - this.player.pos[0],
              shade.pos[2] - this.player.pos[2]
            );
            shade.pos[0] = round3(shade.pos[0] + pdx * this.tuning.pulse_push_m);
            shade.pos[2] = round3(shade.pos[2] + pdz * this.tuning.pulse_push_m);
          }
        }

        stepEvents.push({
          type: "event",
          tick: nextTick,
          name: "pulse",
          data: { stunned_ids: stunnedIds },
        });
      }
    }

    // 5. Shade update & AI
    const litLanterns = this.lanterns.filter((l) => l.lit);
    for (const shade of this.shades) {
      if (shade.state === "stunned") {
        shade.stun_timer -= dt;
        if (shade.stun_timer <= 0) {
          shade.state = "chase";
          shade.stun_timer = 0;
        }
      } else {
        // Move towards player
        const [cdx, cdz] = normalizeXZ(
          this.player.pos[0] - shade.pos[0],
          this.player.pos[2] - shade.pos[2]
        );
        const shadeStep = this.tuning.shade_speed * dt;
        let sx = shade.pos[0] + cdx * shadeStep;
        let sz = shade.pos[2] + cdz * shadeStep;

        // Check safe zones around lit lanterns
        for (const lantern of litLanterns) {
          const dToLantern = distXZ([sx, 0, sz], lantern.pos);
          if (dToLantern < this.tuning.safe_radius) {
            // Cannot enter safe radius, push out to safe_radius edge
            const [outX, outZ] = normalizeXZ(
              sx - lantern.pos[0],
              sz - lantern.pos[2]
            );
            sx = lantern.pos[0] + outX * this.tuning.safe_radius;
            sz = lantern.pos[2] + outZ * this.tuning.safe_radius;
          }
        }

        shade.pos[0] = round3(sx);
        shade.pos[2] = round3(sz);

        // Check hit player
        const dToPlayer = distXZ(shade.pos, this.player.pos);
        if (dToPlayer <= this.tuning.shade_hit_radius) {
          if (this.player.invuln_timer <= 0) {
            this.player.flames = Math.max(0, this.player.flames - 1);
            const dropped = Math.floor(
              this.player.carried * this.tuning.hit_drop_ratio
            );
            this.player.carried -= dropped;
            this.player.invuln_timer = this.tuning.invuln_s;

            stepEvents.push({
              type: "event",
              tick: nextTick,
              name: "player_hit",
              data: {
                by: "shade",
                flames: this.player.flames,
                dropped: dropped,
              },
            });
          }
        }
      }
    }

    // 6. Time update
    this.tick = nextTick;
    this.timeLeftS = Math.max(
      0,
      this.tuning.night1_duration_s - this.tick * dt
    );

    // 7. Check Win / Lose
    const allLit =
      this.lanterns.length > 0 && this.lanterns.every((l) => l.lit);
    if (allLit) {
      this.state = "won";
      // Add end-game win bonus
      const timeBonus = Math.floor(
        this.timeLeftS * this.tuning.score.per_second_left
      );
      const flameBonus = this.player.flames * this.tuning.score.per_flame_left;
      this.score += timeBonus + flameBonus;

      stepEvents.push({
        type: "event",
        tick: this.tick,
        name: "game_over",
        data: { result: "won", reason: "all_lit" },
      });
    } else if (this.player.flames <= 0) {
      this.state = "lost";
      stepEvents.push({
        type: "event",
        tick: this.tick,
        name: "game_over",
        data: { result: "lost", reason: "no_flames" },
      });
    } else if (this.timeLeftS <= 0) {
      this.state = "lost";
      stepEvents.push({
        type: "event",
        tick: this.tick,
        name: "game_over",
        data: { result: "lost", reason: "dawn" },
      });
    }

    for (const ev of stepEvents) {
      this.events.push(ev);
    }

    return stepEvents;
  }

  public getSnapshot(): SnapshotOutput {
    const activeMotesCount = this.motes.filter((m) => !m.collected).length;
    return {
      type: "snapshot",
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: [
          round3(this.player.pos[0]),
          round3(this.player.pos[1]),
          round3(this.player.pos[2]),
        ],
        flames: this.player.flames,
        carried: this.player.carried,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state,
      })),
      motes_active: activeMotesCount,
    };
  }

  public getEndOutput(): EndOutput {
    return {
      type: "end",
      ticks: this.tick,
      state: this.state,
      score: this.score,
    };
  }
}
