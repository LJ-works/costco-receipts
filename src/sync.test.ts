import { describe, expect, it } from "vitest";
import type { MergedReceipt } from "./common/client";
import { selectProductsToFetch } from "./sync";

type TestOrder = Pick<MergedReceipt, "itemArray">;

function order(itemNumbers: string[]): TestOrder {
  return {
    itemArray: itemNumbers.map(
      (itemNumber) => ({ itemNumber }) as MergedReceipt["itemArray"][number],
    ),
  };
}

describe("selectProductsToFetch", () => {
  it("selects uncached product metadata", () => {
    expect(selectProductsToFetch([order(["1", "2"])], new Set(["2"]))).toEqual(["1"]);
  });

  it("does not refresh cached products for pricing", () => {
    expect(selectProductsToFetch([order(["1"])], new Set(["1"]))).toEqual([]);
  });

  it("deduplicates uncached products across orders", () => {
    expect(selectProductsToFetch([order(["1", "2"]), order(["1", "3"])], new Set(["2"]))).toEqual([
      "1",
      "3",
    ]);
  });
});
