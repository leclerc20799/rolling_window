import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RollingWindow, RollingWindowStats } from '../src/index.js';

function approxEqual(a, b, eps = 1e-9) {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= eps;
}

test('rejects non-positive or non-integer window size', () => {
  assert.throws(() => new RollingWindow(0), RangeError);
  assert.throws(() => new RollingWindow(-1), RangeError);
  assert.throws(() => new RollingWindow(2.5), RangeError);
  assert.throws(() => new RollingWindow(NaN), RangeError);
});

test('empty window reports null stats and zero count', () => {
  const w = new RollingWindow(3);
  assert.equal(w.count, 0);
  assert.equal(w.isEmpty, true);
  assert.equal(w.min, null);
  assert.equal(w.max, null);
  assert.equal(w.average, null);
});

test('single push gives min == max == average', () => {
  const w = new RollingWindow(3);
  w.push(7);
  assert.equal(w.count, 1);
  assert.equal(w.min, 7);
  assert.equal(w.max, 7);
  assert.equal(w.average, 7);
});

test('tracks stats as window fills but before eviction', () => {
  const w = new RollingWindow(3);
  w.push(1).push(5).push(3);
  assert.equal(w.count, 3);
  assert.equal(w.min, 1);
  assert.equal(w.max, 5);
  assert.equal(w.average, 3);
});

test('evicts oldest item once window is full', () => {
  const w = new RollingWindow(3);
  w.push(1).push(5).push(3);  // [1, 5, 3]
  w.push(9);                  // evict 1 -> [5, 3, 9]
  assert.equal(w.count, 3);
  assert.equal(w.min, 3);
  assert.equal(w.max, 9);
  assert.ok(approxEqual(w.average, (5 + 3 + 9) / 3));
});

test('eviction is ring-buffer order across multiple wraps', () => {
  const w = new RollingWindow(2);
  w.push(10).push(20); // [10, 20]
  w.push(30);          // [20, 30]
  w.push(40);          // [30, 40]
  assert.equal(w.count, 2);
  assert.equal(w.min, 30);
  assert.equal(w.max, 40);
  assert.ok(approxEqual(w.average, 35));
});

test('average updates correctly after eviction changes the sum', () => {
  const w = new RollingWindow(3);
  for (const v of [100, 200, 300, 4]) w.push(v); // [200, 300, 4]
  assert.ok(approxEqual(w.average, (200 + 300 + 4) / 3));
});

test('handles negative and fractional values', () => {
  const w = new RollingWindow(3);
  w.push(-1.5).push(2.5).push(0);
  assert.equal(w.min, -1.5);
  assert.equal(w.max, 2.5);
  assert.ok(approxEqual(w.average, (-1.5 + 2.5 + 0) / 3));
});

test('min and max survive full eviction of the extreme value', () => {
  const w = new RollingWindow(3);
  w.push(100).push(1).push(50);  // [100, 1, 50], min=1, max=100
  w.push(2);                     // evict 100 -> [1, 50, 2]
  assert.equal(w.min, 1);
  assert.equal(w.max, 50);
  w.push(3);                     // evict 1 -> [50, 2, 3]
  assert.equal(w.min, 2);
  assert.equal(w.max, 50);
});

test('push rejects non-finite numbers', () => {
  const w = new RollingWindow(2);
  assert.throws(() => w.push(NaN), TypeError);
  assert.throws(() => w.push(Infinity), TypeError);
  assert.throws(() => w.push(-Infinity), TypeError);
  assert.throws(() => w.push('5'), TypeError);
});

test('push returns the window for chaining', () => {
  const w = new RollingWindow(2);
  assert.strictEqual(w.push(1), w);
});

test('stats returns a frozen RollingWindowStats snapshot', () => {
  const w = new RollingWindow(3);
  w.push(2).push(4).push(6);
  const s = w.stats();
  assert.ok(s instanceof RollingWindowStats);
  assert.equal(s.count, 3);
  assert.equal(s.size, 3);
  assert.equal(s.min, 2);
  assert.equal(s.max, 6);
  assert.ok(approxEqual(s.average, 4));
  assert.ok(Object.isFrozen(s));
});

test('stats on empty window has null aggregates and zero count', () => {
  const w = new RollingWindow(3);
  const s = w.stats();
  assert.equal(s.count, 0);
  assert.equal(s.min, null);
  assert.equal(s.max, null);
  assert.equal(s.average, null);
});

test('clear resets to empty state', () => {
  const w = new RollingWindow(3);
  w.push(1).push(2).push(3);
  w.clear();
  assert.equal(w.count, 0);
  assert.equal(w.isEmpty, true);
  assert.equal(w.min, null);
  assert.equal(w.max, null);
  assert.equal(w.average, null);
  // Usable again after clear.
  w.push(42);
  assert.equal(w.count, 1);
  assert.equal(w.min, 42);
  assert.equal(w.max, 42);
  assert.equal(w.average, 42);
});

test('window of size 1 evicts on every push after the first', () => {
  const w = new RollingWindow(1);
  w.push(5);
  assert.equal(w.count, 1);
  assert.equal(w.min, 5);
  assert.equal(w.max, 5);
  assert.equal(w.average, 5);
  w.push(8);
  assert.equal(w.count, 1);
  assert.equal(w.min, 8);
  assert.equal(w.max, 8);
  assert.equal(w.average, 8);
});
