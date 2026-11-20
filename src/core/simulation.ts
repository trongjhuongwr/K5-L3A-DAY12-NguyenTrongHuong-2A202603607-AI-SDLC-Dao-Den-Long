import {
  TuningConfig,
  InputFrame,
  ScenarioData,
  PlayerState,
  LanternState,
  ShadeState,
  DrifterState,
  MoteState,
  CharmState,
  WindState,
  SnapshotOutput,
  GameEvent,
  EndOutput,
} from "./types.js";
import {
  round3,
  round1,
  distXZ,
  normalizeXZ,
  transformMoveInput,
} from "./math.js";
import { PRNG } from "./rng.js";
import {
  MapConfig,
  getNight1Map,
  getNight2Map,
  getNight3Map,
} from "./maps.js";

export class Simulation {
  public tick: number = 0;
  public simTick: number = 0;
  public state: "playing" | "paused" | "won" | "lost" = "playing";
  public score: number = 0;
  public timeLeftS: number;
  public night: number;

  public player: PlayerState;
  public lanterns: LanternState[] = [];
  public shades: ShadeState[] = [];
  public drifters: DrifterState[] = [];
  public motes: MoteState[] = [];
  public charms: CharmState[] = [];
  public wind: WindState;

  public events: GameEvent[] = [];
  public tuning: TuningConfig;
  public rng: PRNG;
  public mapConfig: MapConfig;

  // Previous input state for edge-trigger detection
  private prevInteract: boolean = false;
  private prevPulse: boolean = false;
  private prevJump: boolean = false;
  private prevDash: boolean = false;
  private prevPause: boolean = false;

  // Persistent input state
  private currentMove: [number, number] = [0, 0];
  private currentCamYawDeg: number = 0;
  private currentInteract: boolean = false;
  private currentPulse: boolean = false;
  private currentJump: boolean = false;
  private currentDash: boolean = false;
  private currentPause: boolean = false;

  // ID counters
  private moteCounter: number = 0;
  private shadeCounter: number = 0;
  private drifterCounter: number = 0;

  // Dropped motes immunity tracker: Map<moteId, uncollectibleUntilTick>
  private droppedMotesImmunity: Map<string, number> = new Map();

  constructor(
    tuning: TuningConfig,
    seed: number = 42,
    night: number = 1,
    scenario?: ScenarioData
  ) {
    this.tuning = tuning;
    this.night = night;
    this.rng = new PRNG(seed);

    // Select map config based on night
    if (night === 2) {
      this.mapConfig = getNight2Map();
    } else if (night === 3) {
      this.mapConfig = getNight3Map();
    } else {
      this.mapConfig = getNight1Map();
    }

    this.timeLeftS = scenario?.time_left_s ?? this.mapConfig.duration_s;

    // Default spawn pos: Night 3 starts at (0, 0, -15) facing +Z; Night 1 & 2 at (0, 0, 0)
    const defaultPos: [number, number, number] =
      night === 3 ? [0, 0, -15] : [0, 0, 0];

    const initialSuccessfulLights = scenario?.player?.successful_lights ?? 0;
    const initialCapacity = Math.min(
      tuning.capacity_max,
      10 + 2 * initialSuccessfulLights
    );

    // Initialize player
    this.player = {
      pos: scenario?.player?.pos ? [...scenario.player.pos] : [...defaultPos],
      vel: [0, 0, 0],
      grounded: true,
      flames: scenario?.player?.flames ?? tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      capacity: initialCapacity,
      successful_lights: initialSuccessfulLights,
      facingYawDeg: 0,
      invuln_ticks: scenario?.player?.invuln_ticks ?? 0,
      dash_cd_ticks: scenario?.player?.dash_cd_ticks ?? 0,
      pulse_cd_ticks: scenario?.player?.pulse_cd_ticks ?? 0,
      charm_ticks: scenario?.player?.charm_ticks ?? 0,
      dashing_ticks_left: 0,
      dash_dir: [0, 1],
      jump_pad_active: false,
      fall_respawn_wait_ticks: 0,
    };

    // Initialize wind
    this.wind = {
      active: false,
      dir_deg: 0,
      ticks_left: 0,
      cycle_ticks: 0,
    };

    // Initialize lanterns, charms
    this.lanterns = this.mapConfig.lanterns.map((l) => ({
      id: l.id,
      pos: [...l.pos],
      lit: l.lit,
      deposited: l.deposited,
      fuel: l.fuel ?? 0,
      fuel_ticks: Math.round((l.fuel ?? 0) * 60),
      ever_lit: l.ever_lit ?? false,
      relit_count: l.relit_count ?? 0,
    }));

    this.charms = this.mapConfig.charms.map((c) => ({
      id: c.id,
      pos: [...c.pos],
      available: c.available,
      respawn_ticks_left: c.respawn_ticks_left,
    }));

    // Setup scenario or defaults
    this.setupScenario(scenario);
  }

  private setupScenario(scenario?: ScenarioData): void {
    // 1. Lantern overrides
    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const existing = this.lanterns.find((l) => l.id === override.id);
        const lit = override.lit ?? existing?.lit ?? false;
        let fuel = override.fuel;
        if (fuel === undefined) {
          if (lit) fuel = 100;
          else fuel = existing ? existing.fuel : 0;
        }
        const ever_lit =
          override.ever_lit ?? (lit || (existing ? existing.ever_lit : false));

        if (existing) {
          if (override.pos) existing.pos = [...override.pos];
          if (override.deposited !== undefined) existing.deposited = override.deposited;
          existing.lit = lit;
          existing.fuel = fuel;
          existing.fuel_ticks = Math.round(fuel * 60);
          existing.ever_lit = ever_lit;
        } else {
          this.lanterns.push({
            id: override.id,
            pos: override.pos ? [...override.pos] : [0, 0, 0],
            deposited: override.deposited ?? 0,
            lit: lit,
            fuel: fuel,
            fuel_ticks: Math.round(fuel * 60),
            ever_lit: ever_lit,
            relit_count: 0,
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
        kind: "random",
      }));
    } else if (scenario?.random_motes !== false) {
      // Pick 20 distinct points from mapConfig.moteSpawnPoints
      const availablePoints = [...this.mapConfig.moteSpawnPoints];
      for (let i = 0; i < 20 && availablePoints.length > 0; i++) {
        const idx = this.rng.rangeInt(0, availablePoints.length - 1);
        const pt = availablePoints.splice(idx, 1)[0];
        this.motes.push({
          id: `M${++this.moteCounter}`,
          pos: [pt[0], pt[1], pt[2]],
          collected: false,
          kind: "random",
        });
      }
    }

    // 3. Shades
    if (scenario?.shades !== undefined) {
      this.shades = scenario.shades.map((s) => ({
        id: s.id || `S${++this.shadeCounter}`,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state || "wander",
        state_ticks_left: s.state_ticks_left ?? 0,
        push_ticks_left: 0,
        push_dir: [1, 0],
        recoil_dir: [0, 0],
        safe_push_ticks_left: 0,
        target_lantern_id: s.target_lantern_id,
        drain_ticks_active: 0,
        was_draining: false,
      }));
    }

    // 4. Drifters
    if (scenario?.drifters !== undefined) {
      this.drifters = scenario.drifters.map((d) => ({
        id: d.id || `D${++this.drifterCounter}`,
        pos: [round3(d.pos[0]), round3(d.pos[1]), round3(d.pos[2])],
        state: d.state || "idle",
        stolen: d.stolen ?? 0,
        flee_ticks_left: 0,
        hasStolen: (d.stolen ?? 0) > 0,
      }));
    }

    // 5. Charms
    if (scenario?.charms !== undefined) {
      this.charms = scenario.charms.map((c) => ({
        id: c.id,
        pos: c.pos ? [...c.pos] : [0, 0, 0],
        available: c.available ?? true,
        respawn_ticks_left: c.respawn_ticks ?? 0,
      }));
    }
  }

  public applyInputFrame(frame?: InputFrame): void {
    if (!frame) return;
    if (frame.move !== undefined) {
      this.currentMove = [frame.move[0], frame.move[1]];
    }
    if (frame.cam_yaw_deg !== undefined) {
      this.currentCamYawDeg = frame.cam_yaw_deg;
      this.player.facingYawDeg = frame.cam_yaw_deg;
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
    if (frame.dash !== undefined) {
      this.currentDash = frame.dash;
    }
    if (frame.pause !== undefined) {
      this.currentPause = frame.pause;
    }
  }

  // Strict 12-step tick execution
  public step(): GameEvent[] {
    const nextTick = this.tick + 1;
    const stepEvents: GameEvent[] = [];
    const dt = 1.0 / 60.0;

    // Emit night_start at tick 1 (first step execution)
    if (nextTick === 1) {
      stepEvents.push({
        type: "event",
        tick: 1,
        name: "night_start",
        data: { night: this.night },
      });
    }

    // Detect rising edges
    const pauseTriggered = this.currentPause && !this.prevPause;
    const interactTriggered = this.currentInteract && !this.prevInteract;
    const pulseTriggered = this.currentPulse && !this.prevPulse;
    const jumpTriggered = this.currentJump && !this.prevJump;
    const dashTriggered = this.currentDash && !this.prevDash;

    this.prevPause = this.currentPause;
    this.prevInteract = this.currentInteract;
    this.prevPulse = this.currentPulse;
    this.prevJump = this.currentJump;
    this.prevDash = this.currentDash;

    // STEP 1: Đọc input & Xử lý pause
    if (pauseTriggered) {
      if (this.state === "paused") {
        this.state = "playing";
        stepEvents.push({ type: "event", tick: nextTick, name: "resumed", data: {} });
      } else if (this.state === "playing") {
        this.state = "paused";
        stepEvents.push({ type: "event", tick: nextTick, name: "paused", data: {} });
        this.tick = nextTick;
        for (const ev of stepEvents) this.events.push(ev);
        return stepEvents; // dừng bước ở đây khi vừa tạm dừng
      }
    }

    if (this.state === "paused") {
      this.tick = nextTick;
      return stepEvents;
    }

    if (this.state !== "playing") {
      this.tick = nextTick;
      return stepEvents;
    }

    // Tiến hành sim_tick
    this.simTick++;

    // STEP 2: Giảm các bộ đếm & Trừ nhiên liệu đèn (hao tự nhiên + bị hút)
    this.timeLeftS = Math.max(0, this.timeLeftS - dt);

    if (this.player.invuln_ticks > 0) this.player.invuln_ticks--;
    if (this.player.dash_cd_ticks > 0) this.player.dash_cd_ticks--;
    if (this.player.pulse_cd_ticks > 0) this.player.pulse_cd_ticks--;
    if (this.player.charm_ticks > 0) this.player.charm_ticks--;
    if (this.player.fall_respawn_wait_ticks > 0) this.player.fall_respawn_wait_ticks--;

    // TTL đom đóm rơi
    for (const m of this.motes) {
      if (!m.collected && m.kind === "dropped" && m.ttl_ticks !== undefined) {
        m.ttl_ticks--;
        if (m.ttl_ticks <= 0) {
          m.collected = true; // expired
        }
      }
    }

    // Hồi bùa gió
    for (const c of this.charms) {
      if (!c.available) {
        if (c.respawn_ticks_left > 0) {
          c.respawn_ticks_left--;
          if (c.respawn_ticks_left <= 0) {
            c.available = true;
          }
        }
      }
    }

    // Shade counters
    for (const s of this.shades) {
      if (s.state_ticks_left > 0) s.state_ticks_left--;
      if (s.push_ticks_left > 0) s.push_ticks_left--;
      if (s.safe_push_ticks_left > 0) s.safe_push_ticks_left--;
    }

    // Drifter counters
    for (const d of this.drifters) {
      if (d.flee_ticks_left > 0) {
        d.flee_ticks_left--;
        if (d.flee_ticks_left <= 0) {
          d.state = "removed";
        }
      }
    }

    // Wind cycle (Night 3)
    if (this.mapConfig.hasWind) {
      this.wind.cycle_ticks++;
      if (!this.wind.active) {
        if (this.wind.cycle_ticks >= 1800) {
          this.wind.active = true;
          this.wind.ticks_left = 300; // 5s
          this.wind.dir_deg = round3(this.rng.range(0, 360));
          this.wind.cycle_ticks = 0;
        }
      } else {
        this.wind.ticks_left--;
        if (this.wind.ticks_left <= 0) {
          this.wind.active = false;
        }
      }
    }

    // Nhiên liệu đèn: Hao hụt tự nhiên (1/60 đơn vị mỗi tick khi đang sáng)
    for (const l of this.lanterns) {
      if (l.lit) {
        l.fuel_ticks -= 1;
      }
    }

    // Nhiên liệu đèn: Bị Bóng Mực hút (5/60 đơn vị mỗi tick cho mỗi Bóng Mực đang drain)
    for (const s of this.shades) {
      if (s.state === "drain" && s.target_lantern_id) {
        s.drain_ticks_active++;
        const targetL = this.lanterns.find((l) => l.id === s.target_lantern_id);
        if (targetL && targetL.lit) {
          targetL.fuel_ticks -= 5;
          // Phát sự kiện fuel_drain mỗi 60 tick khi đang hút
          if (s.drain_ticks_active > 0 && s.drain_ticks_active % 60 === 0) {
            stepEvents.push({
              type: "event",
              tick: nextTick,
              name: "fuel_drain",
              data: {
                lantern_id: targetL.id,
                shade_id: s.id,
                fuel: round1(Math.max(0, targetL.fuel_ticks / 60.0)),
              },
            });
          }
        }
      }
    }

    // Ngay sau bước 2: Đèn có fuel <= 0 tắt, phát lantern_out
    for (const l of this.lanterns) {
      if (l.lit) {
        if (l.fuel_ticks <= 0) {
          l.fuel_ticks = 0;
          l.fuel = 0;
          l.lit = false;
          l.deposited = 0;
          l.ever_lit = true;
          stepEvents.push({
            type: "event",
            tick: nextTick,
            name: "lantern_out",
            data: { lantern_id: l.id },
          });
        } else {
          l.fuel = round1(l.fuel_ticks / 60.0);
        }
      } else {
        l.fuel_ticks = 0;
        l.fuel = 0;
      }
    }

    // STEP 3: Di chuyển Mây (nhảy, lướt, bục nhảy, gió) & Kiểm tra rơi khỏi đảo
    const defaultSpawnPos: [number, number, number] =
      this.night === 3 ? [0, 0, -15] : [0, 0, 0];

    if (this.player.fall_respawn_wait_ticks === 0 && this.player.pos[1] < -10.0) {
      // Finished 60 tick wait: respawn at start pos
      this.player.pos = [...defaultSpawnPos];
      this.player.vel = [0, 0, 0];
      this.player.grounded = true;
      this.player.invuln_ticks = 90;
      this.player.jump_pad_active = false;
    } else if (this.player.fall_respawn_wait_ticks > 0) {
      // Waiting to respawn, do not move
    } else {
      // Dash initiation
      if (dashTriggered) {
        const canDash = this.player.charm_ticks > 0 || this.player.dash_cd_ticks <= 0;
        if (canDash && this.player.dashing_ticks_left <= 0) {
          this.player.dashing_ticks_left = 12; // 0.2s = 12 ticks
          this.player.dash_cd_ticks = 90; // 1.5s = 90 ticks

          // Determine dash direction
          const [worldDx, worldDz] = transformMoveInput(this.currentMove, this.currentCamYawDeg);
          const moveLen = Math.sqrt(worldDx * worldDx + worldDz * worldDz);
          if (moveLen > 0.01) {
            this.player.dash_dir = [worldDx / moveLen, worldDz / moveLen];
          } else {
            // Facing direction from yaw
            const yawRad = (this.currentCamYawDeg * Math.PI) / 180.0;
            this.player.dash_dir = [Math.sin(yawRad), Math.cos(yawRad)];
          }
          stepEvents.push({ type: "event", tick: nextTick, name: "dash", data: {} });
        }
      }

      // Compute horizontal velocity
      if (this.player.dashing_ticks_left > 0) {
        this.player.dashing_ticks_left--;
        this.player.vel[0] = this.player.dash_dir[0] * 14.0;
        this.player.vel[2] = this.player.dash_dir[1] * 14.0;
        this.player.vel[1] = 0; // Dashing in air preserves height Y
      } else if (this.player.jump_pad_active) {
        this.player.vel[1] -= 20.0 * dt; // gravity
      } else {
        const [worldDx, worldDz] = transformMoveInput(this.currentMove, this.currentCamYawDeg);
        const speed = this.player.charm_ticks > 0 ? 7.2 : 6.0;
        this.player.vel[0] = worldDx * speed;
        this.player.vel[2] = worldDz * speed;

        // Jump
        if (jumpTriggered && this.player.grounded) {
          this.player.vel[1] = 7.0;
          this.player.grounded = false;
        } else if (!this.player.grounded) {
          this.player.vel[1] -= 20.0 * dt; // gravity
        }
      }

      // Wind push effect
      if (this.wind.active && this.player.fall_respawn_wait_ticks === 0) {
        const windRad = (this.wind.dir_deg * Math.PI) / 180.0;
        this.player.vel[0] += Math.cos(windRad) * 2.0;
        this.player.vel[2] += Math.sin(windRad) * 2.0;
      }

      // Apply movement
      let nextX = this.player.pos[0] + this.player.vel[0] * dt;
      let nextY = this.player.pos[1] + this.player.vel[1] * dt;
      let nextZ = this.player.pos[2] + this.player.vel[2] * dt;

      // Check ground collision
      const groundY = this.mapConfig.getGroundHeight(nextX, nextZ);
      if (groundY > -900) {
        if (nextY <= groundY) {
          nextY = groundY;
          this.player.vel[1] = 0;
          this.player.grounded = true;
          this.player.jump_pad_active = false;
        } else {
          this.player.grounded = false;
        }
      } else {
        this.player.grounded = false;
      }

      this.player.pos[0] = round3(nextX);
      this.player.pos[1] = round3(nextY);
      this.player.pos[2] = round3(nextZ);

      // Check Jump Pad trigger
      for (const pad of this.mapConfig.jumpPads) {
        const dXZ = Math.hypot(this.player.pos[0] - pad.pos[0], this.player.pos[2] - pad.pos[2]);
        const dY = Math.abs(this.player.pos[1] - pad.pos[1]);
        if (dXZ <= pad.radius && dY <= 1.0) {
          this.player.jump_pad_active = true;
          this.player.grounded = false;
          this.player.vel[0] = pad.launchVx;
          this.player.vel[1] = pad.launchVy;
          this.player.vel[2] = pad.launchVz;
          break;
        }
      }

      // Check fall off island (Y < -10)
      if (this.player.pos[1] < -10.0) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.fall_respawn_wait_ticks = 60;

        stepEvents.push({
          type: "event",
          tick: nextTick,
          name: "player_hit",
          data: {
            by: "fall",
            flames: this.player.flames,
            lost: lost,
          },
        });

        if (this.player.flames === 0) {
          this.state = "lost";
          stepEvents.push({
            type: "event",
            tick: nextTick,
            name: "game_over",
            data: { result: "lost", reason: "no_flames" },
          });
        }
      }
    }

    // STEP 4: Nhặt đom đóm & Bùa gió (tuân theo sức chứa tăng dần capacity)
    if (this.player.fall_respawn_wait_ticks === 0) {
      // Pick motes
      for (const mote of this.motes) {
        if (!mote.collected) {
          const dropImmunity = this.droppedMotesImmunity.get(mote.id);
          if (dropImmunity !== undefined && dropImmunity >= nextTick) {
            continue;
          }

          const dXZ = distXZ(this.player.pos, mote.pos);
          const dY = Math.abs(this.player.pos[1] - mote.pos[1]);
          if (dXZ <= this.tuning.pickup_radius && dY <= 1.5) {
            if (this.player.carried < this.player.capacity) {
              mote.collected = true;
              this.player.carried++;
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

      // Pick charms
      for (const charm of this.charms) {
        if (charm.available) {
          const dXZ = distXZ(this.player.pos, charm.pos);
          const dY = Math.abs(this.player.pos[1] - charm.pos[1]);
          if (dXZ <= this.tuning.pickup_radius && dY <= 1.5) {
            charm.available = false;
            charm.respawn_ticks_left = 2700;
            this.player.charm_ticks = 600;
            stepEvents.push({
              type: "event",
              tick: nextTick,
              name: "charm_picked",
              data: { charm_id: charm.id, charm_ticks: 600 },
            });
          }
        }
      }
    }

    // STEP 5: Tương tác với Đèn Lồng (Thắp mới, Thắp lại, Châm dầu)
    if (interactTriggered && this.player.fall_respawn_wait_ticks === 0) {
      if (this.player.carried > 0) {
        // Chỉ xét đèn nhận được: chưa sáng, HOẶC sáng nhưng chưa đầy dầu (fuel < 100)
        const candidates = this.lanterns.filter((l) => {
          const eligible = !l.lit || (l.lit && l.fuel_ticks < 6000);
          if (!eligible) return false;
          return distXZ(this.player.pos, l.pos) <= this.tuning.interact_radius;
        });

        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const da = distXZ(this.player.pos, a.pos);
            const db = distXZ(this.player.pos, b.pos);
            if (Math.abs(da - db) > 0.001) return da - db;
            return a.id.localeCompare(b.id);
          });

          const chosen = candidates[0];

          if (!chosen.lit) {
            // Đèn chưa sáng: Thắp đèn (thắp lần đầu hoặc thắp lại)
            const cost = chosen.ever_lit
              ? this.tuning.relight_cost
              : this.tuning.lantern_cost;
            const needed = cost - chosen.deposited;
            const amount = Math.min(this.player.carried, needed);

            if (amount > 0) {
              this.player.carried -= amount;
              chosen.deposited += amount;
              this.score += amount * this.tuning.score.per_mote; // +5 điểm / đom đóm

              stepEvents.push({
                type: "event",
                tick: nextTick,
                name: "deposit",
                data: {
                  lantern_id: chosen.id,
                  amount: amount,
                  deposited: chosen.deposited,
                },
              });

              if (chosen.deposited >= cost) {
                chosen.lit = true;
                chosen.fuel_ticks = 6000;
                chosen.fuel = 100.0;
                chosen.deposited = cost;

                const isRelight = chosen.ever_lit;
                chosen.ever_lit = true;
                if (isRelight) {
                  chosen.relit_count++;
                }

                this.player.successful_lights++;
                this.player.capacity = Math.min(
                  this.tuning.capacity_max,
                  10 + 2 * this.player.successful_lights
                );

                this.score += isRelight
                  ? this.tuning.score.relight_lantern // +40
                  : this.tuning.score.per_lantern; // +100

                stepEvents.push({
                  type: "event",
                  tick: nextTick,
                  name: "lantern_lit",
                  data: {
                    lantern_id: chosen.id,
                    relight: isRelight,
                  },
                });

                // Push any shades currently inside 6m safe zone
                for (const s of this.shades) {
                  const d = distXZ(s.pos, chosen.pos);
                  if (d < this.tuning.safe_radius) {
                    s.safe_push_ticks_left = 30;
                  }
                }
              }
            }
          } else {
            // Đèn đang sáng: Châm dầu
            // used = min(đang mang, ceil((100 − fuel) / 10))
            const currentFuel = chosen.fuel_ticks / 60.0;
            const neededMotes = Math.ceil((100.0 - currentFuel) / 10.0);
            const used = Math.min(this.player.carried, neededMotes);

            if (used > 0) {
              this.player.carried -= used;
              const wasBelow30 = currentFuel < this.tuning.low_fuel_threshold;

              chosen.fuel_ticks = Math.min(6000, chosen.fuel_ticks + used * 10 * 60);
              chosen.fuel = round1(chosen.fuel_ticks / 60.0);
              this.score += used * this.tuning.score.per_mote; // +5 điểm / đom đóm

              stepEvents.push({
                type: "event",
                tick: nextTick,
                name: "refuel",
                data: {
                  lantern_id: chosen.id,
                  amount: used,
                  fuel: chosen.fuel,
                },
              });

              // Khi đèn được châm dầu lên ≥ 30 lúc có Bóng Mực trong vùng 6m:
              // đẩy ra mép vùng 6m trong tối đa 30 tick và không gây sát thương
              const newFuel = chosen.fuel_ticks / 60.0;
              if (wasBelow30 && newFuel >= this.tuning.low_fuel_threshold) {
                for (const s of this.shades) {
                  const d = distXZ(s.pos, chosen.pos);
                  if (d < this.tuning.safe_radius) {
                    s.safe_push_ticks_left = 30;
                  }
                }
              }
            }
          }
        }
      }
    }

    // STEP 6: Cập nhật vùng an toàn quanh đèn đã sáng (Chỉ đèn có fuel >= 30 mới có vùng an toàn)
    const litSafeLanterns = this.lanterns.filter(
      (l) => l.lit && l.fuel_ticks / 60.0 >= this.tuning.low_fuel_threshold
    );

    for (const shade of this.shades) {
      for (const lantern of litSafeLanterns) {
        const d = distXZ(shade.pos, lantern.pos);
        if (d < this.tuning.safe_radius) {
          const [outX, outZ] = normalizeXZ(
            shade.pos[0] - lantern.pos[0],
            shade.pos[2] - lantern.pos[2]
          );
          if (shade.safe_push_ticks_left > 0) {
            // Push out gradually
            const stepOut = (this.tuning.safe_radius - d) / shade.safe_push_ticks_left;
            shade.pos[0] = round3(shade.pos[0] + outX * stepOut);
            shade.pos[2] = round3(shade.pos[2] + outZ * stepOut);
          } else {
            // Hard clamp at 6m edge
            shade.pos[0] = round3(lantern.pos[0] + outX * this.tuning.safe_radius);
            shade.pos[2] = round3(lantern.pos[2] + outZ * this.tuning.safe_radius);
          }
        }
      }
    }

    // STEP 7: Tỏa Sáng (Pulse)
    if (pulseTriggered && this.player.fall_respawn_wait_ticks === 0) {
      if (this.player.carried >= this.tuning.pulse_cost && this.player.pulse_cd_ticks <= 0) {
        this.player.carried -= this.tuning.pulse_cost;
        this.player.pulse_cd_ticks = Math.round(this.tuning.pulse_cooldown_s * 60);

        const pulseCenter: [number, number, number] = [
          this.player.pos[0],
          this.player.pos[1] + 0.8,
          this.player.pos[2],
        ];

        const stunnedIds: string[] = [];

        // Check shades
        for (const shade of this.shades) {
          if (shade.state === "spawning") continue;
          const d3D = Math.sqrt(
            (shade.pos[0] - pulseCenter[0]) ** 2 +
              (shade.pos[1] + 0.8 - pulseCenter[1]) ** 2 +
              (shade.pos[2] - pulseCenter[2]) ** 2
          );
          if (d3D <= this.tuning.pulse_radius) {
            stunnedIds.push(shade.id);
            const wasDrain = shade.state === "drain";
            shade.state = "stunned";
            shade.state_ticks_left = Math.round(this.tuning.pulse_stun_s * 60);
            shade.push_ticks_left = 15;
            shade.drain_ticks_active = 0;
            shade.target_lantern_id = undefined;

            const [pdx, pdz] = normalizeXZ(
              shade.pos[0] - pulseCenter[0],
              shade.pos[2] - pulseCenter[2]
            );
            if (Math.abs(pdx) < 1e-6 && Math.abs(pdz) < 1e-6) {
              shade.push_dir = [1, 0];
            } else {
              shade.push_dir = [pdx, pdz];
            }

            // Điểm Tỏa Sáng: +5 mỗi con, +15 nếu trước đó đang drain
            if (wasDrain) {
              this.score += this.tuning.score.per_drain_stun;
            } else {
              this.score += this.tuning.score.per_stun;
            }
          }
        }

        // Check drifters (Night 2 & 3)
        for (const drifter of this.drifters) {
          if (drifter.state === "chase" || drifter.state === "idle" || drifter.state === "flee") {
            const d3D = Math.sqrt(
              (drifter.pos[0] - pulseCenter[0]) ** 2 +
                (drifter.pos[1] - pulseCenter[1]) ** 2 +
                (drifter.pos[2] - pulseCenter[2]) ** 2
            );
            if (d3D <= this.tuning.pulse_radius) {
              drifter.state = "flee";
              drifter.flee_ticks_left = 120; // 2s flee
              if (drifter.stolen > 0) {
                const droppedCount = drifter.stolen;
                drifter.stolen = 0;
                stepEvents.push({
                  type: "event",
                  tick: nextTick,
                  name: "drifter_drop",
                  data: { drifter_id: drifter.id, amount: droppedCount },
                });

                for (let k = 0; k < droppedCount; k++) {
                  const mId = `M${++this.moteCounter}`;
                  this.motes.push({
                    id: mId,
                    pos: [drifter.pos[0], drifter.pos[1], drifter.pos[2]],
                    collected: false,
                    kind: "dropped",
                    ttl_ticks: 480,
                  });
                  this.droppedMotesImmunity.set(mId, nextTick);
                }
              }
            }
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

    // STEP 8: Di chuyển Bóng Mực và Gió Lạc (Bao gồm logic Drain mới)
    // Move Shades
    for (const shade of this.shades) {
      if (shade.state === "spawning") {
        if (shade.state_ticks_left <= 0) {
          shade.state = "wander";
        }
      } else if (shade.state === "stunned") {
        if (shade.push_ticks_left > 0) {
          const pushStep = this.tuning.pulse_push_m / 15.0;
          shade.pos[0] = round3(shade.pos[0] + shade.push_dir[0] * pushStep);
          shade.pos[2] = round3(shade.pos[2] + shade.push_dir[1] * pushStep);
        }
        if (shade.state_ticks_left <= 0) {
          shade.state = "wander";
        }
      } else if (shade.state === "recoil") {
        const recoilStep = 2.0 / 60.0;
        shade.pos[0] = round3(shade.pos[0] + shade.recoil_dir[0] * recoilStep);
        shade.pos[2] = round3(shade.pos[2] + shade.recoil_dir[1] * recoilStep);
        if (shade.state_ticks_left <= 0) {
          shade.state = "wander";
        }
      } else if (shade.state === "drain") {
        // Đang hút dầu: đứng yên
        // Kiểm tra chuyển sang chase nếu Mây vào trong 6m
        const dToPlayer = distXZ(shade.pos, this.player.pos);
        if (dToPlayer <= 6.0) {
          shade.state = "chase";
          shade.target_lantern_id = undefined;
          shade.drain_ticks_active = 0;
        } else {
          // Kiểm tra chuyển sang wander nếu đèn tắt, fuel >= 30, hoặc cách đèn > 2m
          const targetL = this.lanterns.find((l) => l.id === shade.target_lantern_id);
          const dToLantern = targetL ? distXZ(shade.pos, targetL.pos) : 999;
          if (
            !targetL ||
            !targetL.lit ||
            targetL.fuel_ticks / 60.0 >= this.tuning.low_fuel_threshold ||
            dToLantern > 2.0
          ) {
            shade.state = "wander";
            shade.target_lantern_id = undefined;
            shade.drain_ticks_active = 0;
          }
        }
      } else if (shade.state === "wander" || shade.state === "chase") {
        const dToPlayer = distXZ(shade.pos, this.player.pos);
        if (shade.state === "wander") {
          if (dToPlayer <= 12.0) {
            shade.state = "chase";
          }
        } else if (shade.state === "chase") {
          if (dToPlayer > 18.0) {
            shade.state = "wander";
          }
        }

        if (shade.state === "chase") {
          const [cdx, cdz] = normalizeXZ(
            this.player.pos[0] - shade.pos[0],
            this.player.pos[2] - shade.pos[2]
          );
          const stepDist = this.mapConfig.shadeSpeed * dt;
          shade.pos[0] = round3(shade.pos[0] + cdx * stepDist);
          shade.pos[2] = round3(shade.pos[2] + cdz * stepDist);
        } else if (shade.state === "wander") {
          // Chỉ Bóng Mực ở trạng thái wander mới chọn đèn yếu:
          // Đi tới đèn sáng có fuel < 30 gần nhất (bằng nhau thì id nhỏ hơn).
          // Không có thì đi về đèn tắt gần nhất như trước.
          const lowFuelLanterns = this.lanterns.filter(
            (l) => l.lit && l.fuel_ticks / 60.0 < this.tuning.low_fuel_threshold
          );

          let targetL: LanternState | null = null;
          if (lowFuelLanterns.length > 0) {
            lowFuelLanterns.sort((a, b) => {
              const da = distXZ(shade.pos, a.pos);
              const db = distXZ(shade.pos, b.pos);
              if (Math.abs(da - db) > 0.001) return da - db;
              return a.id.localeCompare(b.id);
            });
            targetL = lowFuelLanterns[0];
          } else {
            const unlitLanterns = this.lanterns.filter((l) => !l.lit);
            if (unlitLanterns.length > 0) {
              unlitLanterns.sort((a, b) => {
                const da = distXZ(shade.pos, a.pos);
                const db = distXZ(shade.pos, b.pos);
                if (Math.abs(da - db) > 0.001) return da - db;
                return a.id.localeCompare(b.id);
              });
              targetL = unlitLanterns[0];
            }
          }

          if (targetL) {
            const dToTarget = distXZ(shade.pos, targetL.pos);
            if (targetL.lit && dToTarget <= 2.0) {
              // Cách đèn yếu <= 2m: chuyển sang drain, đứng yên hút dầu
              shade.state = "drain";
              shade.target_lantern_id = targetL.id;
              shade.drain_ticks_active = 0;
            } else {
              // Đi về phía đèn mục tiêu
              const [wdx, wdz] = normalizeXZ(
                targetL.pos[0] - shade.pos[0],
                targetL.pos[2] - shade.pos[2]
              );
              const stepDist = this.mapConfig.shadeSpeed * dt;
              shade.pos[0] = round3(shade.pos[0] + wdx * stepDist);
              shade.pos[2] = round3(shade.pos[2] + wdz * stepDist);
            }
          }
        }
      }
    }

    // Move Drifters
    for (const drifter of this.drifters) {
      if (drifter.state === "removed") continue;

      const dToPlayer = distXZ(drifter.pos, this.player.pos);
      if (drifter.state === "idle") {
        if (this.player.carried >= 5 && dToPlayer <= 15.0) {
          drifter.state = "chase";
        }
      } else if (drifter.state === "chase") {
        if (this.player.carried < 5 || dToPlayer > 18.0) {
          drifter.state = "idle";
        } else {
          // Fly towards Mây at 7 m/s
          const [ddx, ddz] = normalizeXZ(
            this.player.pos[0] - drifter.pos[0],
            this.player.pos[2] - drifter.pos[2]
          );
          drifter.pos[0] = round3(drifter.pos[0] + ddx * 7.0 * dt);
          drifter.pos[2] = round3(drifter.pos[2] + ddz * 7.0 * dt);

          // Check steal
          if (dToPlayer <= 1.5 && !drifter.hasStolen) {
            const stolenAmount = Math.min(3, this.player.carried);
            this.player.carried -= stolenAmount;
            drifter.stolen = stolenAmount;
            drifter.hasStolen = true;
            drifter.state = "flee";
            drifter.flee_ticks_left = 180; // 3s

            stepEvents.push({
              type: "event",
              tick: nextTick,
              name: "drifter_steal",
              data: {
                drifter_id: drifter.id,
                amount: stolenAmount,
                carried: this.player.carried,
              },
            });
          }
        }
      } else if (drifter.state === "flee") {
        // Fly straight up into sky at 8 m/s
        drifter.pos[1] = round3(drifter.pos[1] + 8.0 * dt);
      }
    }

    // STEP 9: Va chạm gây sát thương (Player Hit by Shade)
    if (this.player.invuln_ticks <= 0 && this.player.fall_respawn_wait_ticks === 0) {
      for (const shade of this.shades) {
        // Only active attacking shades (not spawning, not stunned, not recoil, not draining, not during safe push)
        if (
          shade.safe_push_ticks_left <= 0 &&
          (shade.state === "chase" || shade.state === "wander")
        ) {
          const d = distXZ(this.player.pos, shade.pos);
          if (d <= this.tuning.shade_hit_radius) {
            this.player.flames = Math.max(0, this.player.flames - 1);
            this.player.invuln_ticks = Math.round(this.tuning.invuln_s * 60);

            const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
            this.player.carried -= dropped;

            // Shade recoils
            shade.state = "recoil";
            shade.state_ticks_left = 60;
            const [rcx, rcz] = normalizeXZ(
              shade.pos[0] - this.player.pos[0],
              shade.pos[2] - this.player.pos[2]
            );
            shade.recoil_dir = [rcx, rcz];

            // Scatter dropped motes in ring 1.5 - 2.5m
            for (let k = 0; k < dropped; k++) {
              const angle = this.rng.range(0, 2 * Math.PI);
              const r = this.rng.range(1.5, 2.5);
              const mx = round3(this.player.pos[0] + r * Math.cos(angle));
              const mz = round3(this.player.pos[2] + r * Math.sin(angle));
              const my = this.mapConfig.getGroundHeight(mx, mz);
              const mId = `M${++this.moteCounter}`;
              this.motes.push({
                id: mId,
                pos: [mx, my > -900 ? my : this.player.pos[1], mz],
                collected: false,
                kind: "dropped",
                ttl_ticks: 480,
              });
              this.droppedMotesImmunity.set(mId, nextTick);
            }

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

            break; // Max 1 flame loss per tick
          }
        }
      }
    }

    // STEP 10: Sinh theo lịch (Spawning)
    // 1. Motes spawn every 240 ticks if active < 30
    if (this.simTick > 0 && this.simTick % 240 === 0) {
      const activeCount = this.motes.filter((m) => !m.collected).length;
      if (activeCount < 30) {
        for (const pt of this.mapConfig.moteSpawnPoints) {
          const isOccupied = this.motes.some(
            (m) => !m.collected && distXZ(m.pos, pt) < 1.0
          );
          if (!isOccupied) {
            this.motes.push({
              id: `M${++this.moteCounter}`,
              pos: [pt[0], pt[1], pt[2]],
              collected: false,
              kind: "random",
            });
            break;
          }
        }
      }
    }

    // 2. Shade spawn schedule
    const activeShadesCount = this.shades.length;
    if (activeShadesCount < this.mapConfig.shadeMax) {
      let shouldSpawn = false;
      if (this.simTick === 300) {
        shouldSpawn = true;
      } else if (
        this.simTick > 300 &&
        (this.simTick - 300) % this.mapConfig.shadeSpawnIntervalTicks === 0
      ) {
        shouldSpawn = true;
      }

      if (shouldSpawn) {
        const spawnCount = this.simTick === 300 ? 2 : 1;
        for (
          let sc = 0;
          sc < spawnCount && this.shades.length < this.mapConfig.shadeMax;
          sc++
        ) {
          const eligiblePts = this.mapConfig.shadeSpawnPoints.filter(
            (pt) => distXZ(pt, this.player.pos) >= 15.0
          );
          if (eligiblePts.length > 0) {
            const pt = eligiblePts[this.rng.rangeInt(0, eligiblePts.length - 1)];
            const sId = `S${++this.shadeCounter}`;
            this.shades.push({
              id: sId,
              pos: [pt[0], pt[1], pt[2]],
              state: "spawning",
              state_ticks_left: 60, // 1.0s spawning duration
              push_ticks_left: 0,
              push_dir: [1, 0],
              recoil_dir: [0, 0],
              safe_push_ticks_left: 0,
              drain_ticks_active: 0,
              was_draining: false,
            });
            stepEvents.push({
              type: "event",
              tick: nextTick,
              name: "shade_spawned",
              data: { id: sId },
            });
          }
        }
      }
    }

    // 3. Drifter spawn schedule (Night 2 & 3)
    if (this.mapConfig.hasDrifters) {
      const activeDrifters = this.drifters.filter((d) => d.state !== "removed").length;
      if (activeDrifters < 2 && this.simTick > 0 && this.simTick % 600 === 0) {
        const eligiblePts = this.mapConfig.shadeSpawnPoints.filter(
          (pt) => distXZ(pt, this.player.pos) >= 20.0
        );
        if (eligiblePts.length > 0) {
          const pt = eligiblePts[this.rng.rangeInt(0, eligiblePts.length - 1)];
          const dId = `D${++this.drifterCounter}`;
          this.drifters.push({
            id: dId,
            pos: [pt[0], 2.0, pt[2]],
            state: "idle",
            stolen: 0,
            flee_ticks_left: 0,
            hasStolen: false,
          });
        }
      }
    }

    // STEP 12: Xét thắng / thua (Luật mới Contract v1.2)
    // Diễn ra sau mọi cập nhật của tick, kể cả tick bình minh: hết Ngọn Lửa luôn thua no_flames trước
    if (this.player.flames <= 0) {
      this.state = "lost";
      stepEvents.push({
        type: "event",
        tick: nextTick,
        name: "game_over",
        data: { result: "lost", reason: "no_flames" },
      });
    } else if (this.timeLeftS <= 0) {
      const litCount = this.lanterns.filter((l) => l.lit).length;
      const winThreshold = Math.ceil(this.tuning.win_ratio * this.lanterns.length);

      if (litCount >= winThreshold) {
        this.state = "won";
        // Thưởng thắng bình minh: mỗi đèn đang sáng: +50 + floor(fuel), mỗi ngọn lửa còn lại: +50
        for (const l of this.lanterns) {
          if (l.lit) {
            this.score += this.tuning.score.per_lit_lantern + Math.floor(l.fuel);
          }
        }
        this.score += this.player.flames * this.tuning.score.per_flame_left;

        stepEvents.push({
          type: "event",
          tick: nextTick,
          name: "game_over",
          data: { result: "won", reason: "dawn_survived" },
        });
      } else {
        this.state = "lost";
        stepEvents.push({
          type: "event",
          tick: nextTick,
          name: "game_over",
          data: { result: "lost", reason: "dawn" },
        });
      }
    }

    this.tick = nextTick;
    for (const ev of stepEvents) {
      this.events.push(ev);
    }

    return stepEvents;
  }

  // Contract v1.2 Snapshot Output
  public getSnapshot(): SnapshotOutput {
    const activeMotes = this.motes.filter((m) => !m.collected);
    return {
      type: "snapshot",
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      night: this.night,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dir_deg),
      },
      player: {
        pos: [
          round3(this.player.pos[0]),
          round3(this.player.pos[1]),
          round3(this.player.pos[2]),
        ],
        vel: [
          round3(this.player.vel[0]),
          round3(this.player.vel[1]),
          round3(this.player.vel[2]),
        ],
        grounded: this.player.grounded,
        invuln: this.player.invuln_ticks > 0,
        dash_cd_s: round3(this.player.dash_cd_ticks / 60.0),
        pulse_cd_s: round3(this.player.pulse_cd_ticks / 60.0),
        charm_s: round3(this.player.charm_ticks / 60.0),
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.player.capacity,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuel_ticks / 60.0) : 0,
        ever_lit: l.ever_lit,
        relit_count: l.relit_count,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state,
      })),
      motes: activeMotes.map((m) => ({
        id: m.id,
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])],
        kind: m.kind,
        ttl_s: m.ttl_ticks !== undefined ? round3(m.ttl_ticks / 60.0) : undefined,
      })),
      drifters: this.drifters
        .filter((d) => d.state !== "removed")
        .map((d) => ({
          id: d.id,
          pos: [round3(d.pos[0]), round3(d.pos[1]), round3(d.pos[2])],
          state: d.state,
          stolen: d.stolen,
        })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawn_ticks_left / 60.0),
      })),
      motes_active: activeMotes.length,
    };
  }

  // Contract v1.2 End Output
  public getEndOutput(): EndOutput {
    return {
      type: "end",
      ticks: this.tick,
      state: this.state,
      score: this.score,
    };
  }
}
