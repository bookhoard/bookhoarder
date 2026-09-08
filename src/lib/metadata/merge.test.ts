import { describe, expect, it } from "vitest";
import { roundRobinMerge, raceInCompletionOrder } from "./merge";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("roundRobinMerge", () => {
  it("interleaves lists one item per pass instead of draining the first", () => {
    const result = roundRobinMerge(
      [
        ["a1", "a2", "a3"],
        ["b1", "b2", "b3"],
      ],
      (s) => s,
      4
    );
    expect(result).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("skips items already seen from an earlier list without stalling", () => {
    const result = roundRobinMerge(
      [
        ["shared", "a2"],
        ["shared", "b2"],
      ],
      (s) => s,
      3
    );
    expect(result).toEqual(["shared", "b2", "a2"]);
  });

  it("seeds the dedupe set from excludeKeys (e.g. the item itself)", () => {
    const result = roundRobinMerge([["self", "other"]], (s) => s, 5, ["self"]);
    expect(result).toEqual(["other"]);
  });

  it("stops once every list is exhausted, even under the limit", () => {
    const result = roundRobinMerge([["a1"], ["b1"]], (s) => s, 10);
    expect(result).toEqual(["a1", "b1"]);
  });

  it("stops at the limit mid-pass", () => {
    const result = roundRobinMerge(
      [
        ["a1", "a2"],
        ["b1", "b2"],
      ],
      (s) => s,
      3
    );
    expect(result).toEqual(["a1", "b1", "a2"]);
  });
});

describe("raceInCompletionOrder", () => {
  it("yields results in completion order, not start order", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();

    const generator = raceInCompletionOrder([
      { id: "slow", promise: slow.promise },
      { id: "fast", promise: fast.promise },
    ]);

    const yielded: string[] = [];
    const done = (async () => {
      for await (const { id } of generator) yielded.push(id);
    })();

    // Resolve the "fast" task first even though it was listed second.
    fast.resolve("fast result");
    await Promise.resolve();
    await Promise.resolve();
    slow.resolve("slow result");
    await done;

    expect(yielded).toEqual(["fast", "slow"]);
  });

  it("carries each task's resolved value through to the yielded item", async () => {
    const results: { id: string; value: number }[] = [];
    for await (const item of raceInCompletionOrder([
      { id: "a", promise: Promise.resolve(1) },
      { id: "b", promise: Promise.resolve(2) },
    ])) {
      results.push(item);
    }
    expect(results.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
  });

  it("yields nothing for an empty task list", async () => {
    const results = [];
    for await (const item of raceInCompletionOrder([])) results.push(item);
    expect(results).toEqual([]);
  });
});
