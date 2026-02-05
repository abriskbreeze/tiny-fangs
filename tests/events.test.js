/**
 * Event System Tests
 * TDD: Tests first for event emitter
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('GameEvents', () => {
  let GameEvents;

  beforeEach(async () => {
    const module = await import('../src/events.js');
    GameEvents = module.GameEvents;
    GameEvents.clear();
  });

  describe('on/emit', () => {
    it('calls listener when event is emitted', async () => {
      let called = false;
      GameEvents.on('test', () => { called = true; });
      
      await GameEvents.emit('test', {});
      
      expect(called).toBe(true);
    });

    it('passes context to listener', async () => {
      let receivedCtx = null;
      GameEvents.on('damage', (ctx) => { receivedCtx = ctx; });
      
      await GameEvents.emit('damage', { amount: 20, target: 'opp' });
      
      expect(receivedCtx).toEqual({ amount: 20, target: 'opp' });
    });

    it('calls multiple listeners in order', async () => {
      const order = [];
      GameEvents.on('attack', () => { order.push(1); });
      GameEvents.on('attack', () => { order.push(2); });
      GameEvents.on('attack', () => { order.push(3); });
      
      await GameEvents.emit('attack', {});
      
      expect(order).toEqual([1, 2, 3]);
    });

    it('does nothing if no listeners for event', async () => {
      // Should not throw
      await GameEvents.emit('nonexistent', {});
    });

    it('awaits async listeners', async () => {
      let value = 0;
      GameEvents.on('async', async () => {
        await new Promise(r => setTimeout(r, 10));
        value = 1;
      });
      GameEvents.on('async', () => { value = 2; });
      
      await GameEvents.emit('async', {});
      
      // Second listener should run after first completes
      expect(value).toBe(2);
    });
  });

  describe('off', () => {
    it('removes a specific listener', async () => {
      let count = 0;
      const listener = () => { count++; };
      
      GameEvents.on('test', listener);
      await GameEvents.emit('test', {});
      expect(count).toBe(1);
      
      GameEvents.off('test', listener);
      await GameEvents.emit('test', {});
      expect(count).toBe(1); // Still 1, listener removed
    });

    it('only removes the specified listener', async () => {
      let a = 0, b = 0;
      const listenerA = () => { a++; };
      const listenerB = () => { b++; };
      
      GameEvents.on('test', listenerA);
      GameEvents.on('test', listenerB);
      GameEvents.off('test', listenerA);
      
      await GameEvents.emit('test', {});
      
      expect(a).toBe(0);
      expect(b).toBe(1);
    });
  });

  describe('once', () => {
    it('listener fires only once', async () => {
      let count = 0;
      GameEvents.once('test', () => { count++; });
      
      await GameEvents.emit('test', {});
      await GameEvents.emit('test', {});
      await GameEvents.emit('test', {});
      
      expect(count).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all listeners', async () => {
      let count = 0;
      GameEvents.on('a', () => { count++; });
      GameEvents.on('b', () => { count++; });
      
      GameEvents.clear();
      
      await GameEvents.emit('a', {});
      await GameEvents.emit('b', {});
      
      expect(count).toBe(0);
    });
  });

  describe('event types', () => {
    it('supports beforeAttack event', async () => {
      let ctx = null;
      GameEvents.on('beforeAttack', (c) => { ctx = c; });
      
      await GameEvents.emit('beforeAttack', {
        attacker: { name: 'Cindermaw' },
        defender: { name: 'Thornling' }
      });
      
      expect(ctx.attacker.name).toBe('Cindermaw');
      expect(ctx.defender.name).toBe('Thornling');
    });

    it('supports beforeDamage event', async () => {
      let ctx = null;
      GameEvents.on('beforeDamage', (c) => { ctx = c; });
      
      await GameEvents.emit('beforeDamage', {
        target: { name: 'Gloom' },
        amount: 20,
        source: 'attack'
      });
      
      expect(ctx.amount).toBe(20);
    });

    it('supports onKO event', async () => {
      let ctx = null;
      GameEvents.on('onKO', (c) => { ctx = c; });
      
      await GameEvents.emit('onKO', {
        creature: { name: 'Whisper' },
        owner: 'me',
        killer: { name: 'Duskfang' }
      });
      
      expect(ctx.creature.name).toBe('Whisper');
    });

    it('supports onSummon event', async () => {
      let ctx = null;
      GameEvents.on('onSummon', (c) => { ctx = c; });
      
      await GameEvents.emit('onSummon', {
        creature: { name: 'Emberfang' },
        owner: 'me'
      });
      
      expect(ctx.creature.name).toBe('Emberfang');
    });
  });
});
