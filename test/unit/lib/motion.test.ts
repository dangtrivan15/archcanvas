import { describe, it, expect } from 'vitest';
import {
  duration,
  ease,
  spring,
  entrance,
  bannerTransition,
  withReducedMotion,
} from '@/lib/motion';

describe('motion constants', () => {
  describe('duration', () => {
    it('exports expected duration values', () => {
      expect(duration.fast).toBe(0.12);
      expect(duration.normal).toBe(0.15);
      expect(duration.moderate).toBe(0.2);
      expect(duration.slow).toBe(0.35);
    });

    it('all durations are positive numbers', () => {
      for (const value of Object.values(duration)) {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  describe('ease', () => {
    it('exports easeOut string', () => {
      expect(ease.out).toBe('easeOut');
    });

    it('exports outExpo as a 4-element bezier array', () => {
      expect(ease.outExpo).toHaveLength(4);
      expect(ease.outExpo).toEqual([0.16, 1, 0.3, 1]);
    });

    it('exports standard as a 4-element bezier array', () => {
      expect(ease.standard).toHaveLength(4);
      expect(ease.standard).toEqual([0.4, 0, 0.2, 1]);
    });
  });

  describe('spring', () => {
    it('snappy has expected spring config', () => {
      expect(spring.snappy).toEqual({
        type: 'spring',
        stiffness: 500,
        damping: 30,
      });
    });

    it('smooth has expected spring config', () => {
      expect(spring.smooth.type).toBe('spring');
      expect(spring.smooth.stiffness).toBe(300);
      expect(spring.smooth.damping).toBe(30);
      expect(spring.smooth.bounce).toBe(0);
    });
  });

  describe('entrance presets', () => {
    it('fadeUp has initial with opacity and y', () => {
      expect(entrance.fadeUp.initial).toEqual({ opacity: 0, y: 8 });
      expect(entrance.fadeUp.animate).toEqual({ opacity: 1, y: 0 });
    });

    it('fade has initial with opacity only', () => {
      expect(entrance.fade.initial).toEqual({ opacity: 0 });
      expect(entrance.fade.animate).toEqual({ opacity: 1 });
    });

    it('slideInRight has initial with x offset', () => {
      expect(entrance.slideInRight.initial).toEqual({ opacity: 0, x: 12 });
      expect(entrance.slideInRight.animate).toEqual({ opacity: 1, x: 0 });
    });

    it('slideInLeft has initial with negative x offset', () => {
      expect(entrance.slideInLeft.initial).toEqual({ opacity: 0, x: -12 });
      expect(entrance.slideInLeft.animate).toEqual({ opacity: 1, x: 0 });
    });
  });

  describe('bannerTransition', () => {
    it('uses normal duration and easeOut', () => {
      expect(bannerTransition).toEqual({
        duration: duration.normal,
        ease: ease.out,
      });
    });
  });
});

describe('withReducedMotion', () => {
  const preset = entrance.fadeUp;

  it('returns preset as-is when prefersReduced is false', () => {
    const result = withReducedMotion(false, preset);
    expect(result.initial).toEqual(preset.initial);
    expect(result.animate).toEqual(preset.animate);
    expect(result.transition).toEqual(preset.transition);
  });

  it('returns static values when prefersReduced is true', () => {
    const result = withReducedMotion(true, preset);
    expect(result.initial).toBe(false);
    expect(result.animate).toEqual(preset.animate);
    expect(result.exit).toBeUndefined();
    expect(result.transition).toEqual({ duration: 0 });
  });

  it('treats null (unknown) as normal motion — plays animations', () => {
    const result = withReducedMotion(null, preset);
    expect(result.initial).toEqual(preset.initial);
    expect(result.transition).toEqual(preset.transition);
  });
});
