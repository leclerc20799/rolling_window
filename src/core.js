/**
 * RollingWindow tracks min, max, and average over a sliding window of
 * number-of-items (count-based), not a time-based window.
 *
 * Design decision: count-based window. The brief says "sliding windows over
 * number streams" and is ambiguous about whether the window is measured in
 * items or in time. A count-based window is deterministic without injecting a
 * clock, which keeps tests honest and the API simple. If you need time-based
 * eviction, wrap this and evict by your own count.
 *
 * Trade-off: min and max are maintained by scanning the active buffer on each
 * query. For very large windows this is O(n) per query, but it avoids the
 * bookkeeping and failure modes of a monotonic deque (stale entries, eviction
 * ordering) and the window is small in practice. The average is maintained
 * incrementally with a running sum, so it is O(1) and does not accumulate
 * float error beyond what the inputs themselves carry.
 */
export class RollingWindow {
  constructor(size) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError('window size must be a positive integer');
    }
    this._size = size;
    this._buf = new Array(size);
    this._head = 0;       // next write position
    this._count = 0;      // number of valid items (capped at size)
    this._sum = 0;        // running sum of valid items
  }

  /**
   * Push one sample into the window, evicting the oldest if full.
   * Returns the window so calls can chain.
   */
  push(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError('push expects a finite number');
    }
    const slot = this._head;
    if (this._count === this._size) {
      // Buffer is full: the slot we are about to overwrite holds the oldest
      // item (ring buffer advances head == oldest when full). Subtract it.
      this._sum -= this._buf[slot];
    } else {
      this._count += 1;
    }
    this._buf[slot] = value;
    this._sum += value;
    this._head = (slot + 1) % this._size;
    return this;
  }

  /** Number of items currently in the window (0 up to size). */
  get count() {
    return this._count;
  }

  /** Configured maximum window size. */
  get size() {
    return this._size;
  }

  /** True when no samples have been pushed yet. */
  get isEmpty() {
    return this._count === 0;
  }

  /**
   * Arithmetic mean of the current window, or null if empty.
   * Using null (not NaN) for the empty case so callers can branch on it
   * without a Number.isNaN guard.
   */
  get average() {
    if (this._count === 0) return null;
    return this._sum / this._count;
  }

  /** Smallest value currently in the window, or null if empty. */
  get min() {
    if (this._count === 0) return null;
    // Scan the valid region. Start of valid data is (head - count) mod size,
    // which is correct whether the buffer has wrapped or not.
    const start = (this._head - this._count + this._size) % this._size;
    let m = this._buf[start];
    for (let i = 1; i < this._count; i++) {
      const v = this._buf[(start + i) % this._size];
      if (v < m) m = v;
    }
    return m;
  }

  /** Largest value currently in the window, or null if empty. */
  get max() {
    if (this._count === 0) return null;
    const start = (this._head - this._count + this._size) % this._size;
    let m = this._buf[start];
    for (let i = 1; i < this._count; i++) {
      const v = this._buf[(start + i) % this._size];
      if (v > m) m = v;
    }
    return m;
  }

  /**
   * Snapshot of all current statistics as a plain object.
   * Returned as a fresh object each call so callers cannot mutate internals.
   */
  stats() {
    return new RollingWindowStats(
      this._count,
      this._size,
      this.min,
      this.max,
      this.average
    );
  }

  /** Remove all samples and reset accumulators. */
  clear() {
    this._buf = new Array(this._size);
    this._head = 0;
    this._count = 0;
    this._sum = 0;
    return this;
  }
}

/**
 * Immutable snapshot of a RollingWindow's current statistics.
 * Exposed so callers can read a consistent point-in-time view without
 * holding a reference to the live window.
 */
export class RollingWindowStats {
  constructor(count, size, min, max, average) {
    this.count = count;
    this.size = size;
    this.min = min;
    this.max = max;
    this.average = average;
    Object.freeze(this);
  }
}
