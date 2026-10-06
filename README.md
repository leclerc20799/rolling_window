# Rolling Window

A small ESM TypeScript/JavaScript library that tracks the min, max, and average of a sliding count-based window over a stream of numbers.

```js
import { RollingWindow } from 'rolling-window';

const w = new RollingWindow(3);
w.push(1).push(5).push(3);
w.push(9); // evicts the oldest (1)

w.min;      // 3
w.max;      // 9
w.average;  // 5.666...
w.count;    // 3
w.stats();  // { count, size, min, max, average } (frozen)
```

## Why

The problem is straightforward: given a stream of numbers and a fixed window size N, answer "what are the current min, max, and average over the last N samples?" without keeping every sample forever or re-scanning the whole history on every query.

The average is maintained incrementally with a running sum — O(1) per push and O(1) per query. Min and max are computed by scanning the active buffer on each query — O(N). This avoids the eviction-ordering bookkeeping and subtle staleness bugs of a monotonic deque, at the cost of a linear scan. For the modest window sizes this library is built for, that scan is cheaper to reason about than to optimize away.

## Edge you will hit

The window is count-based, not time-based. There is no clock and no time-based eviction — that decision keeps the API deterministic and the tests honest. If you need time-based eviction, wrap `RollingWindow` and evict by your own count.

`push` rejects `NaN`, `Infinity`, and non-numbers. An empty window returns `null` (not `NaN`) for `min`, `max`, and `average`, so you can branch on it directly without a `Number.isNaN` guard.

## Exports

- `RollingWindow` — the window class. Constructor takes a positive integer window size. Methods: `push(value)`, `clear()`, `stats()`. Properties: `count`, `size`, `isEmpty`, `min`, `max`, `average`.
- `RollingWindowStats` — the frozen snapshot object returned by `stats()`, with fields `count`, `size`, `min`, `max`, `average`.

## Run tests

```
node --test
```
