// Merpati Nusantara — a small seeded RNG so the world is identical
// for every player (and for every screenshot) at a given seed.

// Mulberry32: a tiny, fast seeded PRNG with a good spread.
function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 2D value noise: hashes an integer lattice point to [0, 1).
// Used for the island heightmap so terrain is smooth but never flat.
function hashNoise(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth interpolation (smoothstep) between two values.
function smoothMix(a, b, t) {
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

// Bilinear value noise over the lattice, smooth in both axes.
function valueNoise2D(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hashNoise(ix, iz, seed);
  const b = hashNoise(ix + 1, iz, seed);
  const c = hashNoise(ix, iz + 1, seed);
  const d = hashNoise(ix + 1, iz + 1, seed);
  const u = smoothMix(a, b, fx);
  const v = smoothMix(c, d, fx);
  return smoothMix(u, v, fz);
}
