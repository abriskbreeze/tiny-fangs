import { describe, expect, it } from 'vitest';
import { CREATURES, VERSES } from '../shared/cards.js';
import { Effects } from '../shared/effects.js';
import {
  DERIVED_FACE_REGISTRY,
  PRESENTATION_FACE_INVENTORY,
  buildPresentationFaceInventory,
  resolvePresentationFaceId,
  stampDerivedPresentationFace
} from '../shared/face-registry.js';
import * as shared from '../shared/index.js';

function collectSummonTokenReferences(value, references = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSummonTokenReferences(item, references);
    }
    return references;
  }

  if (!value || typeof value !== 'object') {
    return references;
  }

  if (value.type === 'summonToken') {
    references.push(value.token);
  }

  for (const nested of Object.values(value)) {
    collectSummonTokenReferences(nested, references);
  }

  return references;
}

function createEffectsContext() {
  const me = { bench: [] };
  const opp = { bench: [] };
  return {
    me,
    opp,
    state: { G: { me, opp } }
  };
}

describe('presentation face identity', () => {
  it('resolves catalog cards only through validated catalog IDs', () => {
    expect(resolvePresentationFaceId(CREATURES.emberfang)).toBe('emberfang');
    expect(resolvePresentationFaceId(VERSES.brace)).toBe('brace');
    expect(resolvePresentationFaceId({
      id: 'emberfang',
      name: VERSES.brace.name,
      subtitle: 'Changed display copy',
      text: 'Changed rules copy',
      art: 'Changed art copy'
    })).toBe('emberfang');
  });

  it('requires a registered explicit identity for derived faces', () => {
    expect(resolvePresentationFaceId({
      id: 'hiveling',
      name: 'Antling',
      presentationFaceId: 'antling'
    })).toBe('antling');

    expect(resolvePresentationFaceId({ name: 'Antling' })).toBeNull();
    expect(resolvePresentationFaceId({ id: 'antling', name: 'Antling' })).toBeNull();
    expect(resolvePresentationFaceId({
      id: 'emberfang',
      presentationFaceId: 'unregistered-face'
    })).toBeNull();
    expect(resolvePresentationFaceId(null)).toBeNull();
  });

  it('stamps only registered derived identity metadata', () => {
    const card = {
      id: 'hiveling',
      name: 'Antling',
      subtitle: 'Swarm Drone',
      cost: 1
    };
    const beforeStamp = structuredClone(card);

    expect(stampDerivedPresentationFace(card, 'antling')).toBe(card);
    expect(card).toStrictEqual({
      ...beforeStamp,
      presentationFaceId: 'antling'
    });
    expect(() => stampDerivedPresentationFace({}, 'unknown-token'))
      .toThrow(/unregistered derived face/i);
  });

  it('exports the shared contract without browser asset metadata', () => {
    expect(shared.DERIVED_FACE_REGISTRY).toBe(DERIVED_FACE_REGISTRY);
    expect(shared.PRESENTATION_FACE_INVENTORY).toBe(PRESENTATION_FACE_INVENTORY);
    expect(shared.buildPresentationFaceInventory).toBe(buildPresentationFaceInventory);
    expect(shared.resolvePresentationFaceId).toBe(resolvePresentationFaceId);
    expect(shared.stampDerivedPresentationFace).toBe(stampDerivedPresentationFace);
    expect(JSON.stringify(DERIVED_FACE_REGISTRY)).not.toMatch(/(?:https?:)?\/\//i);
  });
});

describe('presentation face inventory', () => {
  it('contains exactly the 55 catalog faces and registered Antling face', () => {
    const ids = PRESENTATION_FACE_INVENTORY.map(face => face.presentationFaceId);

    expect(PRESENTATION_FACE_INVENTORY).toHaveLength(56);
    expect(new Set(ids).size).toBe(56);
    expect(PRESENTATION_FACE_INVENTORY.filter(face => face.kind === 'creature')).toHaveLength(29);
    expect(PRESENTATION_FACE_INVENTORY.filter(face => face.kind === 'verse')).toHaveLength(26);
    expect(PRESENTATION_FACE_INVENTORY.filter(face => face.kind === 'token')).toStrictEqual([
      {
        source: 'derived',
        sourceId: 'antling',
        kind: 'token',
        presentationFaceId: 'antling'
      }
    ]);
  });

  it('keeps registered derived IDs unique and collision-free with catalog IDs', () => {
    const catalogIds = new Set([
      ...Object.values(CREATURES).map(card => card.id),
      ...Object.values(VERSES).map(card => card.id)
    ]);
    const derivedIds = Object.values(DERIVED_FACE_REGISTRY)
      .map(face => face.presentationFaceId);

    expect(new Set(derivedIds).size).toBe(derivedIds.length);
    for (const id of derivedIds) {
      expect(catalogIds.has(id)).toBe(false);
    }

    expect(() => buildPresentationFaceInventory({
      derivedFaces: {
        ...DERIVED_FACE_REGISTRY,
        collidingToken: {
          kind: 'token',
          presentationFaceId: 'emberfang'
        }
      }
    })).toThrow(/collision/i);

    expect(() => buildPresentationFaceInventory({
      derivedFaces: {
        ...DERIVED_FACE_REGISTRY,
        duplicateOne: {
          kind: 'token',
          presentationFaceId: 'duplicate-face'
        },
        duplicateTwo: {
          kind: 'token',
          presentationFaceId: 'duplicate-face'
        }
      }
    })).toThrow(/duplicate/i);
  });

  it('requires every summonToken reference to have a registry entry', () => {
    const references = collectSummonTokenReferences([
      ...Object.values(CREATURES),
      ...Object.values(VERSES)
    ]);

    expect(references.length).toBeGreaterThan(0);
    for (const token of references) {
      expect(DERIVED_FACE_REGISTRY).toHaveProperty(token);
    }

    expect(() => buildPresentationFaceInventory({
      creatures: {
        futureSummoner: {
          id: 'futureSummoner',
          ability: {
            effects: [{ type: 'summonToken', token: 'future-token' }]
          }
        }
      },
      verses: {},
      derivedFaces: {}
    })).toThrow(/unregistered summonToken.*future-token/i);
  });
});

describe('shared Antling effect identity', () => {
  it('stamps the existing shared Effects Antling without changing its fields or events', () => {
    const ctx = createEffectsContext();

    const result = Effects.summonToken(ctx, { token: 'antling' });

    expect(result.summoned).toBe(true);
    expect(result.creature).toStrictEqual({
      id: 'antling',
      name: 'Antling',
      subtitle: 'Swarm Token',
      hp: 10,
      curHp: 10,
      atk: 10,
      cost: 0,
      cardType: 'creature',
      ability: null,
      uid: expect.any(String),
      isToken: true,
      presentationFaceId: 'antling'
    });
    expect(resolvePresentationFaceId(result.creature)).toBe('antling');
    expect(ctx.me.bench).toStrictEqual([result.creature]);
    expect(result.events).toStrictEqual([
      {
        type: 'log',
        message: 'Antling joins the swarm!',
        style: 'mana'
      },
      {
        type: 'summonBench',
        animKey: 'me',
        benchIndex: 0
      }
    ]);
  });

  it('preserves the unknown-token failure contract', () => {
    const ctx = createEffectsContext();

    expect(Effects.summonToken(ctx, { token: 'unknown-token' })).toStrictEqual({
      events: [],
      summoned: false,
      reason: 'unknown_token'
    });
    expect(ctx.me.bench).toStrictEqual([]);
  });
});
