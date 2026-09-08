/**
 * Interleaves several ranked lists round-robin — one item per list per pass
 * — rather than draining the first list before touching the rest, so a
 * broad/high-volume source (a generic subject, a big provider) can't crowd
 * out a narrower one. Dedupes on `keyOf` as it goes; `excludeKeys` seeds the
 * dedupe set up front (e.g. to exclude the book itself from "similar" results).
 */
export function roundRobinMerge<T>(
  lists: T[][],
  keyOf: (item: T) => string,
  limit: number,
  excludeKeys: Iterable<string> = []
): T[] {
  const seen = new Set<string>(excludeKeys);
  const cursors = lists.map(() => 0);
  const results: T[] = [];

  let madeProgress = true;
  while (results.length < limit && madeProgress) {
    madeProgress = false;
    for (let i = 0; i < lists.length && results.length < limit; i++) {
      const list = lists[i];
      while (cursors[i] < list.length) {
        const item = list[cursors[i]++];
        const key = keyOf(item);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
        madeProgress = true;
        break;
      }
    }
  }
  return results;
}

/**
 * Runs several named tasks in parallel and yields each one's result the
 * moment it settles, in completion order rather than start order — so a
 * fast provider's results reach the caller without waiting on a slow one.
 * Each task's promise must already handle its own errors (e.g. via
 * `.catch(() => fallback)`) since a rejection here would abort the whole race.
 */
export async function* raceInCompletionOrder<Id extends string, T>(
  tasks: { id: Id; promise: Promise<T> }[]
): AsyncGenerator<{ id: Id; value: T }> {
  const pending = new Map(tasks.map(({ id, promise }) => [id, promise.then((value) => ({ id, value }))]));
  while (pending.size > 0) {
    const winner = await Promise.race(pending.values());
    pending.delete(winner.id);
    yield winner;
  }
}
