/**
 * Clamps a numeric value between min and max bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Rounds a number to a specified number of decimal places.
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function round(value, decimals = 1) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Generates a normally distributed random number using Box-Muller transform,
 * centered at (min + max)/2 with sigma = (max - min)/6, clamped to [min, max].
 * 
 * @param {number} min - Minimum normal range bound
 * @param {number} max - Maximum normal range bound
 * @param {Function} [randomFn=Math.random] - Injected random number generator returning [0, 1)
 * @param {number} [decimals=1] - Decimal precision
 * @returns {number} Clamped, rounded, finite normal value
 */
function gaussianRandom(min, max, randomFn = Math.random, decimals = 1) {
  if (min === max) {
    return round(min, decimals);
  }

  // Ensure min < max
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);

  // Avoid log(0) by ensuring u1 is strictly in (0, 1)
  let u1 = randomFn();
  while (u1 <= 0 || u1 >= 1) {
    u1 = u1 === 0 ? 1e-7 : (u1 >= 1 ? 0.9999999 : randomFn());
  }

  let u2 = randomFn();
  while (u2 < 0 || u2 >= 1) {
    u2 = u2 >= 1 ? 0.9999999 : randomFn();
  }

  // Box-Muller transformation
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  const mean = (lower + upper) / 2.0;
  const sigma = (upper - lower) / 6.0;

  const rawValue = mean + (z0 * sigma);
  const clampedValue = clamp(rawValue, lower, upper);

  return round(clampedValue, decimals);
}

/**
 * Generates a smooth continuous step (random walk) for physical properties like temperature.
 * Max change per tick is bounded by maxDelta (e.g. 0.3°C).
 * 
 * @param {number} current - Current value
 * @param {number} maxDelta - Maximum step change (e.g. 0.3)
 * @param {number} min - Lower bound
 * @param {number} max - Upper bound
 * @param {Function} [randomFn=Math.random] - Injected random generator
 * @param {number} [decimals=1] - Decimal precision
 * @returns {number} Next value clamped to [min, max]
 */
function randomWalk(current, maxDelta, min, max, randomFn = Math.random, decimals = 1) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);

  let baseline = current;
  if (typeof baseline !== 'number' || Number.isNaN(baseline) || !Number.isFinite(baseline)) {
    baseline = (lower + upper) / 2.0;
  }

  // Generate random step in [-maxDelta, +maxDelta]
  const u = randomFn();
  const step = (u * 2.0 - 1.0) * maxDelta;

  const nextRaw = baseline + step;
  const nextClamped = clamp(nextRaw, lower, upper);

  return round(nextClamped, decimals);
}

module.exports = {
  clamp,
  round,
  gaussianRandom,
  randomWalk
};
