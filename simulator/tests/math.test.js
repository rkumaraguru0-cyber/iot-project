const { gaussianRandom, randomWalk, clamp, round } = require('../src/generators/math');

describe('Simulator Math Utilities (Phase 5)', () => {
  describe('clamp()', () => {
    it('should clamp values below minimum to minimum', () => {
      expect(clamp(-5, 0, 100)).toBe(0);
      expect(clamp(15, 20, 50)).toBe(20);
    });

    it('should clamp values above maximum to maximum', () => {
      expect(clamp(120, 0, 100)).toBe(100);
      expect(clamp(55, 20, 50)).toBe(50);
    });

    it('should leave values within bounds unchanged', () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(25.5, 20, 50)).toBe(25.5);
    });

    it('should handle non-finite or invalid inputs safely', () => {
      expect(clamp(NaN, 10, 50)).toBe(10);
      expect(clamp(Infinity, 10, 50)).toBe(10);
      expect(clamp(null, 10, 50)).toBe(10);
      expect(clamp(undefined, 10, 50)).toBe(10);
    });
  });

  describe('round()', () => {
    it('should round numbers to specified decimal places', () => {
      expect(round(23.456, 1)).toBe(23.5);
      expect(round(23.444, 1)).toBe(23.4);
      expect(round(23.456, 2)).toBe(23.46);
      expect(round(23.456, 0)).toBe(23);
    });

    it('should handle non-finite inputs safely', () => {
      expect(round(NaN, 1)).toBe(0);
      expect(round(null, 1)).toBe(0);
    });
  });

  describe('gaussianRandom() with Box-Muller transform', () => {
    it('should generate finite numbers within [min, max]', () => {
      for (let i = 0; i < 500; i++) {
        const val = gaussianRandom(10, 40);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThanOrEqual(40);
      }
    });

    it('should return exact number when min equals max', () => {
      expect(gaussianRandom(25, 25)).toBe(25);
    });

    it('should produce deterministic output with injected randomFn', () => {
      // With u1=0.5, u2=0.25 => cos(2*PI*0.25) = cos(PI/2) = 0 => z0 = 0 => value = midpoint
      let callCount = 0;
      const deterministicRandom = () => {
        callCount++;
        return callCount === 1 ? 0.5 : 0.25;
      };

      const result = gaussianRandom(20, 60, deterministicRandom, 1);
      // Midpoint of [20, 60] is 40
      expect(result).toBe(40.0);
    });

    it('should clamp values to bounds even if extreme random values occur', () => {
      // Test very low u1 causing high z0
      const mockExtremeRandom = () => 0.0000001;
      const val = gaussianRandom(10, 30, mockExtremeRandom, 1);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(30);
    });
  });

  describe('randomWalk()', () => {
    it('should stay strictly within [min, max] and step by at most maxDelta', () => {
      let current = 25.0;
      const min = 18.0;
      const max = 28.0;
      const maxDelta = 0.3;

      for (let i = 0; i < 200; i++) {
        const next = randomWalk(current, maxDelta, min, max);
        expect(Number.isFinite(next)).toBe(true);
        expect(next).toBeGreaterThanOrEqual(min);
        expect(next).toBeLessThanOrEqual(max);
        expect(Math.abs(next - current)).toBeLessThanOrEqual(maxDelta + 0.05); // slight epsilon for rounding
        current = next;
      }
    });

    it('should handle invalid baseline by defaulting to midpoint', () => {
      const next = randomWalk(NaN, 0.3, 20, 40);
      expect(Number.isFinite(next)).toBe(true);
      expect(next).toBeGreaterThanOrEqual(20);
      expect(next).toBeLessThanOrEqual(40);
    });
  });
});
