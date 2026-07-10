import { describe, expect, it } from "vitest";
import type { MergedReceipt } from "./common/client";
import { selectProductsToFetch } from "./sync";

type TestOrder = Pick<MergedReceipt, "transactionDate" | "itemArray">;

function order(transactionDate: string, itemNumbers: string[]): TestOrder {
  return {
    transactionDate,
    itemArray: itemNumbers.map(
      (itemNumber) => ({ itemNumber }) as MergedReceipt["itemArray"][number],
    ),
  };
}

describe("selectProductsToFetch", () => {
  const now = new Date("2026-07-09T12:00:00Z");

  it("selects uncached products", () => {
    expect(selectProductsToFetch([order("2026-05-01", ["1"])], new Set(), now)).toEqual(["1"]);
  });

  it("does not select cached products older than recent window", () => {
    expect(selectProductsToFetch([order("2026-05-01", ["1"])], new Set(["1"]), now)).toEqual([]);
  });

  it("selects cached products purchased within recent window", () => {
    expect(selectProductsToFetch([order("2026-07-01", ["1"])], new Set(["1"]), now)).toEqual(["1"]);
  });

  it("deduplicates across orders", () => {
    expect(
      selectProductsToFetch(
        [order("2026-07-01", ["1", "2"]), order("2026-06-01", ["1", "3"])],
        new Set(["1"]),
        now,
      ).sort(),
    ).toEqual(["1", "2", "3"]);
  });
});
