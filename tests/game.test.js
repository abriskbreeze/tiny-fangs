import { describe, it, expect } from 'vitest';
import { applyDamage, applyHeal, createCreature, createVerse } from '../src/game.js';

describe('applyDamage', () => {
  it('reduces HP correctly', () => {
    const creature = { curHp: 50, hp: 50 };
    const ko = applyDamage(creature, 20);
    expect(creature.curHp).toBe(30);
    expect(ko).toBe(false);
  });

  it('clamps HP to 0 on overkill', () => {
    const creature = { curHp: 30, hp: 30 };
    const ko = applyDamage(creature, 50);
    expect(creature.curHp).toBe(0);
    expect(ko).toBe(true);
  });

  it('returns true on exact lethal', () => {
    const creature = { curHp: 20, hp: 20 };
    const ko = applyDamage(creature, 20);
    expect(creature.curHp).toBe(0);
    expect(ko).toBe(true);
  });

  it('never results in negative HP', () => {
    const creature = { curHp: 10, hp: 30 };
    applyDamage(creature, 100);
    expect(creature.curHp).toBeGreaterThanOrEqual(0);
  });
});

describe('applyHeal', () => {
  it('heals correctly', () => {
    const creature = { curHp: 30, hp: 50 };
    applyHeal(creature, 15);
    expect(creature.curHp).toBe(45);
  });

  it('caps at max HP', () => {
    const creature = { curHp: 40, hp: 50 };
    applyHeal(creature, 20);
    expect(creature.curHp).toBe(50);
  });
});

describe('createCreature', () => {
  it('creates a creature with correct fields', () => {
    const template = { id: 'test', name: 'Test', hp: 40, atk: 20 };
    const creature = createCreature(template);
    
    expect(creature.id).toBe('test');
    expect(creature.name).toBe('Test');
    expect(creature.hp).toBe(40);
    expect(creature.curHp).toBe(40);
    expect(creature.atk).toBe(20);
    expect(creature.cardType).toBe('creature');
    expect(creature.status).toBeNull();
    expect(creature.uid).toBeTruthy();
    expect(creature.firstAtk).toBe(true);
  });
});

describe('createVerse', () => {
  it('creates a verse with correct fields', () => {
    const template = { id: 'soulTrap', name: 'Soul Trap', type: 'set', cost: 2 };
    const verse = createVerse(template);
    
    expect(verse.id).toBe('soulTrap');
    expect(verse.name).toBe('Soul Trap');
    expect(verse.type).toBe('set');
    expect(verse.cost).toBe(2);
    expect(verse.cardType).toBe('verse');
    expect(verse.uid).toBeTruthy();
  });
});
