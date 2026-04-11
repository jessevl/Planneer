/**
 * @file crdt.test.ts
 * @description Unit tests for CRDT utilities (HLC, LWW merge, field comparison)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compareHLC,
  isHLCGreater,
  maxHLC,
  serializeHLC,
  deserializeHLC,
  HybridLogicalClock,
  createFieldHLCs,
  updateFieldHLCs,
  mergeRecords,
  type HLCTimestamp,
  type CRDTMetadata,
} from './crdt';

// ============================================================================
// HLC Comparison Tests
// ============================================================================

describe('HLC Comparison', () => {
  describe('compareHLC', () => {
    it('compares by timestamp first', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 0, node: 'a' };
      const b: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
      
      expect(compareHLC(a, b)).toBeLessThan(0);
      expect(compareHLC(b, a)).toBeGreaterThan(0);
    });

    it('compares by counter when timestamps equal', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 1, node: 'a' };
      const b: HLCTimestamp = { ts: 1000, counter: 5, node: 'a' };
      
      expect(compareHLC(a, b)).toBeLessThan(0);
      expect(compareHLC(b, a)).toBeGreaterThan(0);
    });

    it('compares by node lexicographically when ts and counter equal', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 1, node: 'aaa' };
      const b: HLCTimestamp = { ts: 1000, counter: 1, node: 'bbb' };
      
      expect(compareHLC(a, b)).toBeLessThan(0);
      expect(compareHLC(b, a)).toBeGreaterThan(0);
    });

    it('returns 0 for identical HLCs', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 1, node: 'abc' };
      const b: HLCTimestamp = { ts: 1000, counter: 1, node: 'abc' };
      
      expect(compareHLC(a, b)).toBe(0);
    });
  });

  describe('isHLCGreater', () => {
    it('returns true when first is greater', () => {
      const a: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
      const b: HLCTimestamp = { ts: 1000, counter: 0, node: 'a' };
      
      expect(isHLCGreater(a, b)).toBe(true);
    });

    it('returns false when first is less', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 0, node: 'a' };
      const b: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
      
      expect(isHLCGreater(a, b)).toBe(false);
    });

    it('returns false when equal', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 1, node: 'a' };
      const b: HLCTimestamp = { ts: 1000, counter: 1, node: 'a' };
      
      expect(isHLCGreater(a, b)).toBe(false);
    });
  });

  describe('maxHLC', () => {
    it('returns the greater HLC', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 0, node: 'a' };
      const b: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
      
      expect(maxHLC(a, b)).toEqual(b);
      expect(maxHLC(b, a)).toEqual(b);
    });

    it('returns first when equal', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 1, node: 'a' };
      const b: HLCTimestamp = { ts: 1000, counter: 1, node: 'a' };
      
      expect(maxHLC(a, b)).toEqual(a);
    });
  });
});

// ============================================================================
// HLC Serialization Tests
// ============================================================================

describe('HLC Serialization', () => {
  describe('serializeHLC', () => {
    it('serializes to padded string format', () => {
      const hlc: HLCTimestamp = { ts: 1704067200000, counter: 42, node: 'abc123' };
      const serialized = serializeHLC(hlc);
      
      expect(serialized).toBe('001704067200000:000042:abc123');
    });

    it('produces lexicographically sortable strings', () => {
      const a: HLCTimestamp = { ts: 1000, counter: 0, node: 'a' };
      const b: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
      
      const serializedA = serializeHLC(a);
      const serializedB = serializeHLC(b);
      
      expect(serializedA < serializedB).toBe(true);
    });
  });

  describe('deserializeHLC', () => {
    it('deserializes from string format', () => {
      const hlc = deserializeHLC('001704067200000:000042:abc123');
      
      expect(hlc).toEqual({
        ts: 1704067200000,
        counter: 42,
        node: 'abc123',
      });
    });

    it('round-trips correctly', () => {
      const original: HLCTimestamp = { ts: 1704067200000, counter: 99, node: 'xyz789' };
      const roundTripped = deserializeHLC(serializeHLC(original));
      
      expect(roundTripped).toEqual(original);
    });
  });
});

// ============================================================================
// HybridLogicalClock Class Tests
// ============================================================================

describe('HybridLogicalClock', () => {
  let clock: HybridLogicalClock;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    
    // Mock localStorage for nodeId persistence
    const mockStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockStorage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('tick', () => {
    it('generates monotonically increasing timestamps', () => {
      clock = new HybridLogicalClock('test-node');
      
      const t1 = clock.tick();
      const t2 = clock.tick();
      const t3 = clock.tick();
      
      expect(isHLCGreater(t2, t1)).toBe(true);
      expect(isHLCGreater(t3, t2)).toBe(true);
    });

    it('increments counter within same millisecond', () => {
      clock = new HybridLogicalClock('test-node');
      
      const t1 = clock.tick();
      const t2 = clock.tick();
      
      expect(t2.ts).toBe(t1.ts);
      expect(t2.counter).toBe(t1.counter + 1);
    });

    it('resets counter when time advances', () => {
      clock = new HybridLogicalClock('test-node');
      
      clock.tick(); // counter = 0
      clock.tick(); // counter = 1
      clock.tick(); // counter = 2
      
      const beforeAdvance = clock.now();
      
      // Advance time
      vi.advanceTimersByTime(1);
      
      const afterAdvance = clock.tick();
      expect(afterAdvance.counter).toBe(0);
      expect(afterAdvance.ts).toBeGreaterThan(beforeAdvance.ts);
    });
  });

  describe('receive', () => {
    it('catches up to remote timestamp', () => {
      clock = new HybridLogicalClock('local');
      
      const remoteHLC: HLCTimestamp = {
        ts: Date.now() + 10000, // 10 seconds in the future
        counter: 5,
        node: 'remote',
      };
      
      const received = clock.receive(remoteHLC);
      
      expect(received.ts).toBe(remoteHLC.ts);
      expect(received.counter).toBeGreaterThan(remoteHLC.counter);
      expect(received.node).toBe('local');
    });

    it('stays ahead if local is already ahead', () => {
      clock = new HybridLogicalClock('local');
      
      // Tick several times to advance local clock
      clock.tick();
      clock.tick();
      const localNow = clock.now();
      
      const remoteHLC: HLCTimestamp = {
        ts: localNow.ts - 1000, // 1 second in the past
        counter: 0,
        node: 'remote',
      };
      
      const received = clock.receive(remoteHLC);
      
      expect(received.ts).toBe(localNow.ts);
      expect(received.counter).toBeGreaterThan(localNow.counter);
    });
  });

  describe('export/restore', () => {
    it('exports current state', () => {
      clock = new HybridLogicalClock('test-node');
      clock.tick();
      clock.tick();
      
      const exported = clock.export();
      
      expect(exported.nodeId).toBe('test-node');
      expect(typeof exported.ts).toBe('number');
      expect(typeof exported.counter).toBe('number');
    });

    it('restores state if ahead of wall clock', () => {
      clock = new HybridLogicalClock('test-node');
      
      const futureState = {
        ts: Date.now() + 60000, // 1 minute in future
        counter: 100,
      };
      
      clock.restore(futureState);
      const current = clock.now();
      
      expect(current.ts).toBe(futureState.ts);
      expect(current.counter).toBe(futureState.counter);
    });

    it('uses wall clock if stored state is in past', () => {
      clock = new HybridLogicalClock('test-node');
      
      const pastState = {
        ts: Date.now() - 60000, // 1 minute in past
        counter: 100,
      };
      
      clock.restore(pastState);
      const current = clock.now();
      
      expect(current.ts).toBe(Date.now());
      expect(current.counter).toBe(0);
    });
  });
});

// ============================================================================
// Field HLC Management Tests
// ============================================================================

describe('Field HLC Management', () => {
  const testHLC: HLCTimestamp = { ts: 1000, counter: 0, node: 'test' };

  describe('createFieldHLCs', () => {
    it('creates HLCs for existing fields', () => {
      const data = { title: 'Test', description: 'Hello' };
      const fields = ['title', 'description', 'dueDate'] as const;
      
      const hlcs = createFieldHLCs(data, fields, testHLC);
      
      expect(hlcs).toEqual({
        title: testHLC,
        description: testHLC,
      });
      expect(hlcs.dueDate).toBeUndefined();
    });

    it('handles empty data', () => {
      const data = {};
      const fields = ['title', 'description'] as const;
      
      const hlcs = createFieldHLCs(data, fields, testHLC);
      
      expect(hlcs).toEqual({});
    });
  });

  describe('updateFieldHLCs', () => {
    it('updates specified fields', () => {
      const current = {
        title: { ts: 1000, counter: 0, node: 'a' },
        description: { ts: 1000, counter: 0, node: 'a' },
      };
      const newHLC: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
      
      const updated = updateFieldHLCs(current, ['title'], newHLC);
      
      expect(updated.title).toEqual(newHLC);
      expect(updated.description).toEqual(current.description);
    });

    it('adds new fields', () => {
      const current = {
        title: { ts: 1000, counter: 0, node: 'a' },
      };
      const newHLC: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
      
      const updated = updateFieldHLCs(current, ['dueDate'], newHLC);
      
      expect(updated.dueDate).toEqual(newHLC);
      expect(updated.title).toEqual(current.title);
    });
  });
});

// ============================================================================
// Record Merge Tests
// ============================================================================

describe('mergeRecords', () => {
  const fields = ['title', 'description', 'priority'] as const;

  interface TestRecord extends CRDTMetadata {
    title: string;
    description: string;
    priority: string;
  }

  it('remote wins for newer fields', () => {
    const localHLC: HLCTimestamp = { ts: 1000, counter: 0, node: 'local' };
    const remoteHLC: HLCTimestamp = { ts: 2000, counter: 0, node: 'remote' };
    
    const local: TestRecord = {
      title: 'Local Title',
      description: 'Local Desc',
      priority: 'low',
      _hlc: localHLC,
      _fieldHLCs: {
        title: localHLC,
        description: localHLC,
        priority: localHLC,
      },
    };
    
    const remote: TestRecord = {
      title: 'Remote Title',
      description: 'Remote Desc',
      priority: 'high',
      _hlc: remoteHLC,
      _fieldHLCs: {
        title: remoteHLC,
        description: remoteHLC,
        priority: remoteHLC,
      },
    };
    
    const { merged, hadLocalChanges } = mergeRecords(local, remote, fields);
    
    expect(merged.title).toBe('Remote Title');
    expect(merged.description).toBe('Remote Desc');
    expect(merged.priority).toBe('high');
    expect(hadLocalChanges).toBe(false);
  });

  it('local wins for newer fields', () => {
    const localHLC: HLCTimestamp = { ts: 2000, counter: 0, node: 'local' };
    const remoteHLC: HLCTimestamp = { ts: 1000, counter: 0, node: 'remote' };
    
    const local: TestRecord = {
      title: 'Local Title',
      description: 'Local Desc',
      priority: 'low',
      _hlc: localHLC,
      _fieldHLCs: {
        title: localHLC,
        description: localHLC,
        priority: localHLC,
      },
    };
    
    const remote: TestRecord = {
      title: 'Remote Title',
      description: 'Remote Desc',
      priority: 'high',
      _hlc: remoteHLC,
      _fieldHLCs: {
        title: remoteHLC,
        description: remoteHLC,
        priority: remoteHLC,
      },
    };
    
    const { merged, hadLocalChanges } = mergeRecords(local, remote, fields);
    
    expect(merged.title).toBe('Local Title');
    expect(merged.description).toBe('Local Desc');
    expect(merged.priority).toBe('low');
    expect(hadLocalChanges).toBe(true);
  });

  it('merges field-by-field when timestamps differ per field', () => {
    const oldHLC: HLCTimestamp = { ts: 1000, counter: 0, node: 'a' };
    const newHLC: HLCTimestamp = { ts: 2000, counter: 0, node: 'a' };
    
    const local: TestRecord = {
      title: 'Local Title', // newer
      description: 'Local Desc', // older
      priority: 'low',
      _hlc: newHLC,
      _fieldHLCs: {
        title: newHLC,
        description: oldHLC,
        priority: oldHLC,
      },
    };
    
    const remote: TestRecord = {
      title: 'Remote Title', // older
      description: 'Remote Desc', // newer
      priority: 'high',
      _hlc: newHLC,
      _fieldHLCs: {
        title: oldHLC,
        description: newHLC,
        priority: newHLC,
      },
    };
    
    const { merged, hadLocalChanges } = mergeRecords(local, remote, fields);
    
    expect(merged.title).toBe('Local Title'); // Local wins
    expect(merged.description).toBe('Remote Desc'); // Remote wins
    expect(merged.priority).toBe('high'); // Remote wins
    expect(hadLocalChanges).toBe(true);
  });
});
