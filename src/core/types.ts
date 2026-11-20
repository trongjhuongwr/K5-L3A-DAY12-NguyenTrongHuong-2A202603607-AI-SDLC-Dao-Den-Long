export interface TuningConfig {
  player_speed: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  carry_capacity: number;
  capacity_max: number;
  lantern_cost: number;
  relight_cost: number;
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  low_fuel_threshold: number;
  drain_per_s: number;
  win_ratio: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: {
    per_mote: number;
    per_lantern: number;
    relight_lantern: number;
    per_stun: number;
    per_drain_stun: number;
    per_second_left: number;
    per_flame_left: number;
    per_lit_lantern: number;
  };
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputsData {
  frames: InputFrame[];
}

export interface ScenarioData {
  player?: {
    pos?: [number, number, number];
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
    successful_lights?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: [number, number, number][];
  shades?: {
    id?: string;
    pos: [number, number, number];
    state?: string;
    state_ticks_left?: number;
    target_lantern_id?: string;
  }[];
  drifters?: {
    id?: string;
    pos: [number, number, number];
    state?: string;
    stolen?: number;
  }[];
  charms?: {
    id: string;
    pos?: [number, number, number];
    available?: boolean;
    respawn_ticks?: number;
  }[];
  lanterns?: {
    id: string;
    pos?: [number, number, number];
    deposited?: number;
    lit?: boolean;
    fuel?: number;
    ever_lit?: boolean;
  }[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: [number, number, number];
  vel: [number, number, number];
  grounded: boolean;
  flames: number;
  carried: number;
  capacity: number;
  successful_lights: number;
  facingYawDeg: number;
  invuln_ticks: number;
  dash_cd_ticks: number;
  pulse_cd_ticks: number;
  charm_ticks: number;
  // Dashing state
  dashing_ticks_left: number;
  dash_dir: [number, number];
  // Jump pad ballistic state
  jump_pad_active: boolean;
  // Fall recovery state
  fall_respawn_wait_ticks: number;
}

export interface LanternState {
  id: string;
  pos: [number, number, number];
  lit: boolean;
  deposited: number;
  fuel: number; // 0 to 100
  fuel_ticks: number; // 0 to 6000 for exact 1/60 integer arithmetic
  ever_lit: boolean;
  relit_count: number;
}

export type ShadeStateType =
  | "spawning"
  | "wander"
  | "chase"
  | "recoil"
  | "stunned"
  | "drain";

export interface ShadeState {
  id: string;
  pos: [number, number, number];
  state: ShadeStateType | string;
  state_ticks_left: number;
  push_ticks_left: number;
  push_dir: [number, number];
  recoil_dir: [number, number];
  safe_push_ticks_left: number;
  target_lantern_id?: string;
  drain_ticks_active: number;
  was_draining: boolean;
}

export type DrifterStateType = "idle" | "chase" | "flee" | "removed";

export interface DrifterState {
  id: string;
  pos: [number, number, number];
  state: DrifterStateType | string;
  stolen: number;
  flee_ticks_left: number;
  hasStolen: boolean;
}

export interface MoteState {
  id: string;
  pos: [number, number, number];
  collected: boolean;
  kind: "random" | "dropped";
  ttl_ticks?: number;
}

export interface CharmState {
  id: string;
  pos: [number, number, number];
  available: boolean;
  respawn_ticks_left: number;
}

export interface WindState {
  active: boolean;
  dir_deg: number;
  ticks_left: number;
  cycle_ticks: number;
}

export interface SnapshotOutput {
  type: "snapshot";
  tick: number;
  sim_tick: number;
  state: "playing" | "paused" | "won" | "lost";
  time_left_s: number;
  score: number;
  night: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: [number, number, number];
    vel: [number, number, number];
    grounded: boolean;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
    flames: number;
    carried: number;
    capacity: number;
  };
  lanterns: {
    id: string;
    pos: [number, number, number];
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
  }[];
  shades: {
    id: string;
    pos: [number, number, number];
    state: string;
  }[];
  motes: {
    id: string;
    pos: [number, number, number];
    kind: "random" | "dropped";
    ttl_s?: number;
  }[];
  drifters: {
    id: string;
    pos: [number, number, number];
    state: string;
    stolen: number;
  }[];
  charms: {
    id: string;
    available: boolean;
    respawn_s: number;
  }[];
  motes_active: number;
}

export interface GameEvent {
  type: "event";
  tick: number;
  name:
    | "mote_picked"
    | "deposit"
    | "lantern_lit"
    | "pulse"
    | "player_hit"
    | "shade_spawned"
    | "game_over"
    | "dash"
    | "charm_picked"
    | "drifter_steal"
    | "drifter_drop"
    | "night_start"
    | "paused"
    | "resumed"
    | "refuel"
    | "lantern_out"
    | "fuel_drain";
  data: Record<string, unknown>;
}

export interface EndOutput {
  type: "end";
  ticks: number;
  state: "playing" | "won" | "lost";
  score: number;
}
