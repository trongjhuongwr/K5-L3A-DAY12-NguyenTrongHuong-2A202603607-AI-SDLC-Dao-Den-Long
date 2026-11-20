export interface TuningConfig {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
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
    per_stun: number;
    per_second_left: number;
    per_flame_left: number;
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
}

export interface InputsData {
  frames: InputFrame[];
}

export interface ScenarioData {
  player?: {
    pos?: [number, number, number];
    carried?: number;
    flames?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: [number, number, number][];
  shades?: {
    id?: string;
    pos: [number, number, number];
  }[];
  lanterns?: {
    id: string;
    pos?: [number, number, number];
    deposited?: number;
    lit?: boolean;
  }[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: [number, number, number];
  flames: number;
  carried: number;
  invuln_timer: number;
  pulse_cooldown_timer: number;
}

export interface LanternState {
  id: string;
  pos: [number, number, number];
  lit: boolean;
  deposited: number;
}

export interface ShadeState {
  id: string;
  pos: [number, number, number];
  state: "chase" | "stunned" | string;
  stun_timer: number;
}

export interface MoteState {
  id: string;
  pos: [number, number, number];
  collected: boolean;
}

export interface SnapshotOutput {
  type: "snapshot";
  tick: number;
  sim_tick: number;
  state: "playing" | "won" | "lost";
  time_left_s: number;
  score: number;
  player: {
    pos: [number, number, number];
    flames: number;
    carried: number;
  };
  lanterns: {
    id: string;
    pos: [number, number, number];
    lit: boolean;
    deposited: number;
  }[];
  shades: {
    id: string;
    pos: [number, number, number];
    state: string;
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
    | "game_over";
  data: Record<string, unknown>;
}

export interface EndOutput {
  type: "end";
  ticks: number;
  state: "playing" | "won" | "lost";
  score: number;
}
