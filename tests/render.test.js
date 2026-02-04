import { describe, it, expect } from 'vitest';
import { 
  hearts, 
  manaStr, 
  renderManaPips, 
  renderSetVerse, 
  renderActiveCard, 
  renderMiniCard, 
  renderHandCard,
  renderLogEntries,
  renderLogInline
} from '../src/render.js';

describe('hearts', () => {
  it('shows full hearts for 3 LP', () => {
    expect(hearts(3)).toBe('♥♥♥');
  });

  it('shows partial hearts for 2 LP', () => {
    expect(hearts(2)).toBe('♥♥♡');
  });

  it('shows empty hearts for 0 LP', () => {
    expect(hearts(0)).toBe('♡♡♡');
  });

  it('handles negative LP', () => {
    expect(hearts(-1)).toBe('♡♡♡♡');
  });
});

describe('manaStr', () => {
  it('shows full mana', () => {
    expect(manaStr({ mana: 3, maxMana: 3 })).toBe('●●●');
  });

  it('shows partial mana', () => {
    expect(manaStr({ mana: 1, maxMana: 3 })).toBe('●○○');
  });

  it('shows empty mana', () => {
    expect(manaStr({ mana: 0, maxMana: 2 })).toBe('○○');
  });
});

describe('renderManaPips', () => {
  it('generates correct pip HTML', () => {
    const html = renderManaPips(2, 3);
    expect(html).toContain('filled');
    expect((html.match(/filled/g) || []).length).toBe(2);
  });

  it('shows 5 pips total', () => {
    const html = renderManaPips(1, 5);
    expect((html.match(/d-mana-pip/g) || []).length).toBe(5);
  });
});

describe('renderSetVerse', () => {
  it('shows [SET] when verse exists', () => {
    const html = renderSetVerse({ id: 'test' }, 'my-set');
    expect(html).toContain('[SET]');
    expect(html).toContain('has');
  });

  it('shows NO SET when no verse', () => {
    const html = renderSetVerse(null, 'my-set');
    expect(html).toContain('NO SET');
    expect(html).not.toContain('has');
  });
});

describe('renderActiveCard', () => {
  it('returns EMPTY for null creature', () => {
    expect(renderActiveCard(null)).toContain('EMPTY');
  });

  it('renders creature with correct data', () => {
    const creature = {
      uid: 'abc123',
      name: 'Whisper',
      hp: 30,
      curHp: 20,
      atk: 20,
      art: '/\\_/\\',
      status: null
    };
    const html = renderActiveCard(creature);
    expect(html).toContain('Whisper');
    expect(html).toContain('20/30');
    expect(html).toContain('ATK 20');
    expect(html).toContain('abc123');
  });

  it('shows low class when HP <= 30%', () => {
    const creature = {
      uid: 'test',
      name: 'Test',
      hp: 100,
      curHp: 25,
      atk: 10,
      art: 'X',
      status: null
    };
    const html = renderActiveCard(creature);
    expect(html).toContain('low');
  });

  it('shows status when present', () => {
    const creature = {
      uid: 'test',
      name: 'Test',
      hp: 30,
      curHp: 30,
      atk: 10,
      art: 'X',
      status: 'poisoned'
    };
    const html = renderActiveCard(creature);
    expect(html).toContain('[poisoned]');
  });
});

describe('renderMiniCard', () => {
  it('renders mini card with name and stats', () => {
    const creature = { uid: 'xyz', name: 'Gloom', hp: 20, curHp: 15 };
    const html = renderMiniCard(creature);
    expect(html).toContain('Gloom');
    expect(html).toContain('15/20');
    expect(html).toContain('xyz');
  });
});

describe('renderHandCard', () => {
  it('renders creature card', () => {
    const card = { uid: 'c1', name: 'Whisper', cost: 1, cardType: 'creature' };
    const html = renderHandCard(card, false, null);
    expect(html).toContain('Whisper');
    expect(html).toContain('creature');
    expect(html).toContain('Creature');
  });

  it('renders cast verse card', () => {
    const card = { uid: 'v1', name: 'Dark Pact', cost: 1, cardType: 'verse', type: 'cast' };
    const html = renderHandCard(card, false, null);
    expect(html).toContain('Dark Pact');
    expect(html).toContain('verse-cast');
    expect(html).toContain('Cast');
  });

  it('renders set verse card', () => {
    const card = { uid: 'v2', name: 'Phantom Wall', cost: 1, cardType: 'verse', type: 'set' };
    const html = renderHandCard(card, false, null);
    expect(html).toContain('verse-set');
    expect(html).toContain('Set');
  });

  it('adds selected class when card is selected', () => {
    const card = { uid: 'sel1', name: 'Test', cost: 1, cardType: 'creature' };
    const html = renderHandCard(card, false, 'sel1');
    expect(html).toContain('selected');
  });

  it('renders vertical layout for desktop', () => {
    const card = { uid: 'd1', name: 'Test', cost: 2, cardType: 'creature' };
    const html = renderHandCard(card, true, null);
    expect(html).toContain('d-hand-card');
  });

  it('renders horizontal layout for mobile', () => {
    const card = { uid: 'm1', name: 'Test', cost: 2, cardType: 'creature' };
    const html = renderHandCard(card, false, null);
    expect(html).toContain('hand-card');
    expect(html).not.toContain('d-hand-card');
  });
});

describe('renderLogEntries', () => {
  it('renders log entries with classes', () => {
    const log = [
      { t: 'Attack!', c: 'dmg' },
      { t: 'Healed', c: 'heal' }
    ];
    const html = renderLogEntries(log, 10);
    expect(html).toContain('Attack!');
    expect(html).toContain('dmg');
    expect(html).toContain('Healed');
    expect(html).toContain('heal');
  });

  it('respects limit', () => {
    const log = [
      { t: 'One', c: '' },
      { t: 'Two', c: '' },
      { t: 'Three', c: '' }
    ];
    const html = renderLogEntries(log, 2);
    expect(html).not.toContain('One');
    expect(html).toContain('Two');
    expect(html).toContain('Three');
  });
});

describe('renderLogInline', () => {
  it('renders as spans instead of divs', () => {
    const log = [{ t: 'Test', c: 'info' }];
    const html = renderLogInline(log, 10);
    expect(html).toContain('<span');
    expect(html).not.toContain('<div');
  });
});
