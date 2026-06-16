export function hexToWorld(c, r) {
  const w = 1.0;
  const h = Math.sqrt(3) / 2; // ~0.8660254
  const x = (c + 0.5 * (r % 2)) * w;
  const z = r * h;
  return { x, z };
}

export function worldToHex(x, z) {
  const w = 1.0;
  const h = Math.sqrt(3) / 2;

  // Fractional coordinates
  const r_fract = z / h;
  const q_fract = x - 0.5 * r_fract;
  const s_fract = -q_fract - r_fract;

  // Rounding axial coordinates
  let q_round = Math.round(q_fract);
  let r_round = Math.round(r_fract);
  let s_round = Math.round(s_fract);

  const dq = Math.abs(q_round - q_fract);
  const dr = Math.abs(r_round - r_fract);
  const ds = Math.abs(s_round - s_fract);

  if (dq > dr && dq > ds) {
    q_round = -r_round - s_round;
  } else if (dr > ds) {
    r_round = -q_round - s_round;
  } else {
    s_round = -q_round - r_round;
  }

  // Convert axial coordinates back to offset coordinates (odd-r)
  const c = q_round + Math.floor(r_round / 2);
  const r = r_round;
  return { c, r };
}

export function getHexDistance(c1, r1, c2, r2) {
  const q1 = c1 - Math.floor(r1 / 2);
  const r1_axial = r1;
  const s1 = -q1 - r1_axial;

  const q2 = c2 - Math.floor(r2 / 2);
  const r2_axial = r2;
  const s2 = -q2 - r2_axial;

  return Math.round((Math.abs(q1 - q2) + Math.abs(r1_axial - r2_axial) + Math.abs(s1 - s2)) / 2);
}
