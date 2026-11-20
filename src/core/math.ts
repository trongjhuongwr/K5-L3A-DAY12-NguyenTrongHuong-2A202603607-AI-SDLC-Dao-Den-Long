export function round3(val: number): number {
  return Math.round(val * 1000) / 1000;
}

export function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

export function distXZ(
  p1: [number, number, number],
  p2: [number, number, number]
): number {
  const dx = p1[0] - p2[0];
  const dz = p1[2] - p2[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export function normalizeXZ(dx: number, dz: number): [number, number] {
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1e-6) {
    return [0, 0];
  }
  return [dx / len, dz / len];
}

export function transformMoveInput(
  move: [number, number],
  camYawDeg: number
): [number, number] {
  let [x, z] = move;
  const len = Math.sqrt(x * x + z * z);
  if (len > 1.0) {
    x = x / len;
    z = z / len;
  }

  // Convert yaw degrees to radians
  const theta = (camYawDeg * Math.PI) / 180.0;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // x' = x*cosθ + z*sinθ
  // z' = -x*sinθ + z*cosθ
  const xPrime = x * cosT + z * sinT;
  const zPrime = -x * sinT + z * cosT;

  return [xPrime, zPrime];
}
