// SLYDE — the flow engine (Part 2: The cancellation law).
//
// THE CANCELLATION LAW: every manual action — any button, back arrow, or map
// node tap — calls clearFlow() and kills ALL pending automation instantly.
// The game drives when you're passive; you drive when you're active; the two
// never fight. Screens also clear on unmount as a safety net.

let flowSeq = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();

/**
 * Schedule `fn` to run after `ms` — UNLESS clearFlow() is called first.
 * Returns a per-timer cancel function.
 */
export function after(ms: number, fn: () => void): () => void {
  const seq = flowSeq;
  const t = setTimeout(() => {
    timers.delete(t);
    if (seq === flowSeq) {
      fn();
    }
  }, ms);
  timers.add(t);
  return () => {
    timers.delete(t);
    clearTimeout(t);
  };
}

/** Cancel every pending flow timer. Call on ANY manual input. */
export function clearFlow(): void {
  flowSeq++;
  for (const t of timers) {
    clearTimeout(t);
  }
  timers.clear();
}
