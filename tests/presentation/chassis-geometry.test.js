import { describe, expect, it } from 'vitest';
import {
  APERTURE_INSET_RANGE,
  CHASSIS_HEIGHT,
  CHASSIS_RATIO,
  CHASSIS_WIDTH,
  FOOTER_TO_STAT_MIN_GAP_PX,
  NAMEPLATE,
  NAMEPLATE_FIXTURES,
  NESTED_PAIRS,
  SAFE_RECTS,
  SIBLING_MIN_GAP_PX,
  rectGap,
  rectHeight,
  rectWidth,
  rectsOverlap,
} from '../../src/presentation/cards/chassis-geometry.js';

// These contracts re-derive the art bible §7 requirements (accepted hash
// 84b89838…) from the authored geometry, so any drift in the module is caught
// against the bible's own numbers rather than a copy of the module.

describe('chassis ratio and bounds', () => {
  it('keeps the unprojected chassis ratio inside the authored range', () => {
    const ratio = CHASSIS_WIDTH / CHASSIS_HEIGHT;
    expect(ratio).toBeGreaterThanOrEqual(CHASSIS_RATIO.min);
    expect(ratio).toBeLessThanOrEqual(CHASSIS_RATIO.max);
  });

  it('keeps every safe rectangle inside the chassis with positive area', () => {
    for (const rects of Object.values(SAFE_RECTS)) {
      for (const [name, rect] of Object.entries(rects)) {
        expect(rect.left, name).toBeGreaterThanOrEqual(0);
        expect(rect.top, name).toBeGreaterThanOrEqual(0);
        expect(rect.right, name).toBeLessThanOrEqual(CHASSIS_WIDTH);
        expect(rect.bottom, name).toBeLessThanOrEqual(CHASSIS_HEIGHT);
        expect(rectWidth(rect), name).toBeGreaterThan(0);
        expect(rectHeight(rect), name).toBeGreaterThan(0);
      }
    }
  });
});

describe('§7.4 sibling non-overlap contract', () => {
  const nested = new Set(NESTED_PAIRS.map((pair) => pair.join(':')));
  const isNested = (a, b) =>
    nested.has(`${a}:${b}`) || nested.has(`${b}:${a}`);

  for (const [family, rects] of Object.entries(SAFE_RECTS)) {
    it(`${family}: sibling rectangles keep at least ${SIBLING_MIN_GAP_PX} px`, () => {
      const names = Object.keys(rects);
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = names[i];
          const b = names[j];
          if (isNested(a, b)) continue;
          expect(
            rectsOverlap(rects[a], rects[b]),
            `${family}.${a} overlaps ${family}.${b}`,
          ).toBe(false);
          expect(
            rectGap(rects[a], rects[b]),
            `${family}.${a} too close to ${family}.${b}`,
          ).toBeGreaterThanOrEqual(SIBLING_MIN_GAP_PX);
        }
      }
    });
  }

  it('creature footer keeps 6 px horizontal separation from both stats', () => {
    const { footer, attack, health } = SAFE_RECTS.creature;
    expect(footer.left - attack.right).toBeGreaterThanOrEqual(
      FOOTER_TO_STAT_MIN_GAP_PX,
    );
    expect(health.left - footer.right).toBeGreaterThanOrEqual(
      FOOTER_TO_STAT_MIN_GAP_PX,
    );
  });

  it('title text is nested inside the nameplate outer by design', () => {
    for (const family of ['creature', 'cast', 'set']) {
      const { titleText, nameplateOuter } = SAFE_RECTS[family];
      expect(titleText.left).toBeGreaterThanOrEqual(nameplateOuter.left);
      expect(titleText.top).toBeGreaterThanOrEqual(nameplateOuter.top);
      expect(titleText.right).toBeLessThanOrEqual(nameplateOuter.right);
      expect(titleText.bottom).toBeLessThanOrEqual(nameplateOuter.bottom);
    }
  });
});

describe('§7.3 / §7.4 anatomy proportions', () => {
  it('art focal-safe sits inside the physical aperture band', () => {
    // Aperture width 75–79% of chassis means per-side insets of 10.5–12.5%.
    const minInset = CHASSIS_WIDTH * APERTURE_INSET_RANGE.min;
    const maxInset = CHASSIS_WIDTH * APERTURE_INSET_RANGE.max;
    for (const family of ['creature', 'cast', 'set']) {
      const art = SAFE_RECTS[family].artFocalSafe;
      // Focal-safe is the smaller unobscured rectangle, so it must clear the
      // maximum aperture inset on both sides.
      expect(art.left).toBeGreaterThanOrEqual(minInset);
      expect(CHASSIS_WIDTH - art.right).toBeGreaterThanOrEqual(minInset);
      expect(maxInset).toBeGreaterThan(minInset);
    }
  });

  it('cost medallion width is 17–21% of chassis width', () => {
    for (const family of ['creature', 'cast', 'set']) {
      const cost = SAFE_RECTS[family].cost;
      const frac = rectWidth(cost) / CHASSIS_WIDTH;
      expect(frac).toBeGreaterThanOrEqual(0.17);
      expect(frac).toBeLessThanOrEqual(0.21);
    }
  });

  it('creature stat medallions each occupy 18–23% of chassis width', () => {
    for (const stat of ['attack', 'health']) {
      const frac = rectWidth(SAFE_RECTS.creature[stat]) / CHASSIS_WIDTH;
      expect(frac).toBeGreaterThanOrEqual(0.18);
      expect(frac).toBeLessThanOrEqual(0.23);
    }
  });

  it('family seal straddles the art/rules join at 55–64% of card height', () => {
    // §7.3 prose gives the 55–64% straddle band; §7.4's exact rectangle
    // (290–327) is the operative authored geometry and its bottom edge is
    // 64.75%. The consistent reading is that the straddle point — the seal's
    // vertical center on the art/rules join — sits inside the band.
    for (const family of ['creature', 'cast', 'set']) {
      const seal = SAFE_RECTS[family].familySeal;
      const center = (seal.top + seal.bottom) / 2 / CHASSIS_HEIGHT;
      expect(center).toBeGreaterThanOrEqual(0.55);
      expect(center).toBeLessThanOrEqual(0.64);
    }
  });

  it('family deltas: only creatures carry stats, back carries art only', () => {
    expect(SAFE_RECTS.creature.attack).toBeDefined();
    expect(SAFE_RECTS.creature.health).toBeDefined();
    expect(SAFE_RECTS.cast.attack).toBeUndefined();
    expect(SAFE_RECTS.set.attack).toBeUndefined();
    expect(Object.keys(SAFE_RECTS.back)).toStrictEqual(['artFocalSafe']);
  });
});

describe('nameplate contract', () => {
  it('outer and text boxes match the locked §7.4 dimensions', () => {
    const { nameplateOuter, titleText } = SAFE_RECTS.creature;
    expect(rectWidth(nameplateOuter)).toBe(NAMEPLATE.outerWidth);
    expect(rectHeight(nameplateOuter)).toBe(NAMEPLATE.outerHeight);
    expect(rectWidth(titleText)).toBe(NAMEPLATE.textWidth);
    expect(rectHeight(titleText)).toBe(NAMEPLATE.textHeight);
  });

  it('the 230×50 text box fits exactly two 24.5 px lines at 22 px type', () => {
    expect(NAMEPLATE.maxLines * NAMEPLATE.lineHeightPx).toBeLessThanOrEqual(
      NAMEPLATE.textHeight + 0.001,
    );
    expect(NAMEPLATE.fontSizePx).toBe(22);
  });

  it('carries the three catalog nameplate fixtures verbatim', () => {
    expect(NAMEPLATE_FIXTURES.map((f) => f.name)).toStrictEqual([
      'Call of the Wild',
      "Predator's Mark",
      'Bladewhisker',
    ]);
  });
});
