/** File writes still on their way to disk, so a rename or move can wait for them instead of racing them. */
const pending = new Set<Promise<unknown>>();

export function trackWrite<T>(write: Promise<T>): Promise<T> {
  pending.add(write);
  void write.finally(() => pending.delete(write));
  return write;
}

/** Resolves once every write started so far has finished (whether it worked or not). */
export async function settleWrites(): Promise<void> {
  await Promise.allSettled(pending);
}
