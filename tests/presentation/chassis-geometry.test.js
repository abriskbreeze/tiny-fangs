import { describe, expect, it } from 'vitest';
import {
  ART_WINDOW_RATIO,
  CHASSIS_HEIGHT,
  CHASSIS_RATIO,
  CHASSIS_WIDTH,
  FOOTER_TO_STAT_MIN_GAP_PX,
  FRAME_INSET_RANGE,
  NAMEPLATE,
  NAMEPLATE_FIXTURES,
  NESTED_PAIRS,
  RESERVED_RECTS,
  SAFE_RECTS,
  SIBLING_MIN_GAP_PX,
  STRADDLE_PAIRS,
  rectGap,
  rectHeight,
  rectWidth,
  rectsOverlap,
} from '../../src/presentation/cards/chassis-geometry.js';

// These contracts re-derive the art bible §7 requirements (accepted hash
// 84b89838…, as revised by the approved 2026-07-29 inset-window layout) from
// the authored geometry, so any drift in the module is caught against the
// design's own numbers rather than a copy of the module.

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
  // Two declared exemptions, both structural rather than incidental: the
  // title box nests inside the nameplate, and the family seal deliberately
  // straddles the art window's lower edge.
  const exempt = new Set(
    [...NESTED_PAIRS, ...STRADDLE_PAIRS].map((pair) => pair.join(':')),
  );
  const isExempt = (a, b) =>
    exempt.has(`${a}:${b}`) || exempt.has(`${b}:${a}`);

  for (const [family, rects] of Object.entries(SAFE_RECTS)) {
    it(`${family}: sibling rectangles keep at least ${SIBLING_MIN_GAP_PX} px`, () => {
      const names = Object.keys(rects);
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = names[i];
          const b = names[j];
          if (isExempt(a, b)) continue;
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

  // The one overlap the contract allows has to be the intended one: a seal
  // that genuinely sits on the art window's lower edge, not a rectangle that
  // has drifted wholly onto or off the illustration.
  it('the family seal straddles the art window bottom edge, exempting nothing else', () => {
    expect(STRADDLE_PAIRS).toStrictEqual([['familySeal', 'artFocalSafe']]);
    for (const family of ['creature', 'cast', 'set']) {
      const { familySeal, artFocalSafe } = SAFE_RECTS[family];
      expect(familySeal.top).toBeLessThan(artFocalSafe.bottom);
      expect(familySeal.bottom).toBeGreaterThan(artFocalSafe.bottom);
      expect(familySeal.left).toBeGreaterThanOrEqual(artFocalSafe.left);
      expect(familySeal.right).toBeLessThanOrEqual(artFocalSafe.right);
    }
  });

  // Reserved rectangles are still held to the contract: the approved layout
  // must leave room for them without touching the art window or nameplate.
  it('reserved rectangles stay clear of the art window and the nameplate', () => {
    expect(RESERVED_RECTS).toStrictEqual(['statusStack', 'inspectGlyph']);
    for (const family of ['creature', 'cast', 'set']) {
      const rects = SAFE_RECTS[family];
      for (const reserved of RESERVED_RECTS) {
        for (const neighbour of ['artFocalSafe', 'nameplateOuter']) {
          expect(
            rectsOverlap(rects[reserved], rects[neighbour]),
            `${family}.${reserved} overlaps ${neighbour}`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('§7.3 / §7.4 anatomy proportions', () => {
  it('the art window clears the opaque frame band on both sides', () => {
    // The frame is opaque and 5.5–7.0% of the width per side; the art window
    // is inset further still, so the frame reads all the way around it.
    const minInset = CHASSIS_WIDTH * FRAME_INSET_RANGE.min;
    const maxInset = CHASSIS_WIDTH * FRAME_INSET_RANGE.max;
    expect(maxInset).toBeGreaterThan(minInset);
    for (const family of ['creature', 'cast', 'set']) {
      const art = SAFE_RECTS[family].artFocalSafe;
      expect(art.left).toBeGreaterThan(maxInset);
      expect(CHASSIS_WIDTH - art.right).toBeGreaterThan(maxInset);
      expect(art.top).toBeGreaterThan(maxInset);
    }
  });

  it('the art window is exactly 7:5 and 39.6% of chassis height', () => {
    for (const family of ['creature', 'cast', 'set']) {
      const art = SAFE_RECTS[family].artFocalSafe;
      expect(rectWidth(art)).toBe(280);
      expect(rectHeight(art)).toBe(200);
      expect(rectWidth(art) / rectHeight(art)).toBeCloseTo(ART_WINDOW_RATIO, 6);
      expect(rectHeight(art) / CHASSIS_HEIGHT).toBeCloseTo(0.396, 3);
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
    // §7.3 prose gives the 55–64% straddle band; the approved rectangle
    // (257–300) centers at 55.1%, so the straddle point — the seal's vertical
    // center on the art window's lower edge — still sits inside the band.
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
  it('outer and text boxes match the locked dimensions', () => {
    const { nameplateOuter, titleText } = SAFE_RECTS.creature;
    expect(rectWidth(nameplateOuter)).toBe(NAMEPLATE.outerWidth);
    expect(rectHeight(nameplateOuter)).toBe(NAMEPLATE.outerHeight);
    expect(rectWidth(titleText)).toBe(NAMEPLATE.textWidth);
    expect(rectHeight(titleText)).toBe(NAMEPLATE.textHeight);
  });

  it('the declared padding is what separates the text box from the outer', () => {
    const { nameplateOuter, titleText } = SAFE_RECTS.creature;
    expect(titleText.left - nameplateOuter.left).toBe(NAMEPLATE.paddingX);
    expect(nameplateOuter.right - titleText.right).toBe(NAMEPLATE.paddingX);
    expect(titleText.top - nameplateOuter.top).toBe(NAMEPLATE.paddingY);
    expect(nameplateOuter.bottom - titleText.bottom).toBe(NAMEPLATE.paddingY);
  });

  it('the 211×36 text box fits exactly one 24.5 px line at 22 px type', () => {
    expect(NAMEPLATE.maxLines * NAMEPLATE.lineHeightPx).toBeLessThanOrEqual(
      NAMEPLATE.textHeight + 0.001,
    );
    // And a second line would not fit, which is why maxLines is 1.
    expect((NAMEPLATE.maxLines + 1) * NAMEPLATE.lineHeightPx).toBeGreaterThan(
      NAMEPLATE.textHeight,
    );
    expect(NAMEPLATE.fontSizePx).toBe(22);
  });

  it('the nameplate band clears the cost medallion it sits beside', () => {
    for (const family of ['creature', 'cast', 'set']) {
      const { nameplateOuter, cost } = SAFE_RECTS[family];
      expect(nameplateOuter.left - cost.right).toBeGreaterThanOrEqual(
        SIBLING_MIN_GAP_PX,
      );
      expect(nameplateOuter.right).toBeLessThanOrEqual(CHASSIS_WIDTH);
    }
  });

  it('carries the three catalog nameplate fixtures verbatim', () => {
    expect(NAMEPLATE_FIXTURES.map((f) => f.name)).toStrictEqual([
      'Call of the Wild',
      "Predator's Mark",
      'Bladewhisker',
    ]);
  });
});
