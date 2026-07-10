import { describe, expect, it } from "vitest";
import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "../../common/client";
import { findPriceMatches, historicalItemPrice, isWeightedItem } from "./price-match";

const now = new Date("2026-07-09T12:00:00");

function item(
  itemNumber: string,
  partial: Partial<Pick<MergedReceiptItem, "amount" | "discount" | "itemUnitPriceAmount">> = {},
): MergedReceiptItem {
  return {
    itemNumber,
    amount: 10,
    discount: 0,
    itemUnitPriceAmount: 10,
    ...partial,
  } as MergedReceiptItem;
}

function order(
  transactionDate: string,
  itemArray: MergedReceiptItem[],
  partial: Partial<Pick<MergedReceipt, "receiptType" | "transactionType">> = {},
): MergedReceipt {
  return {
    transactionDate,
    itemArray,
    receiptType: "In-Warehouse",
    transactionType: "Sales",
    ...partial,
  } as MergedReceipt;
}

function products(prices: Record<string, number | null>): ProductDetailMap {
  return Object.fromEntries(
    Object.entries(prices).map(([itemNumber, listPrice]) => [
      itemNumber,
      { itemNumber, itemActualName: `Item ${itemNumber}`, listPrice },
    ]),
  ) as ProductDetailMap;
}

describe("findPriceMatches", () => {
  it("matches a recent warehouse sale using the discounted historical price", () => {
    const receipt = order("2026-07-09", [item("1", { amount: 10, discount: -2 })]);

    expect(findPriceMatches([receipt], products({ "1": 7 }), now)).toMatchObject([
      {
        order: receipt,
        items: [{ item: receipt.itemArray[0], quantity: 1, oldPrice: 8, newPrice: 7 }],
      },
    ]);
  });

  it("includes the thirtieth day and excludes older orders", () => {
    const boundary = order("2026-06-09", [item("1")]);
    const older = order("2026-06-08", [item("2")]);

    expect(
      findPriceMatches([older, boundary], products({ "1": 9, "2": 9 }), now, 30),
    ).toMatchObject([{ order: boundary }]);
  });

  it("skips non-warehouse and refund orders", () => {
    const nonWarehouse = order("2026-07-09", [item("1")], { receiptType: "Gas Station" });
    const refund = order("2026-07-09", [item("2")], { transactionType: "Refund" });

    expect(findPriceMatches([nonWarehouse, refund], products({ "1": 9, "2": 9 }), now)).toEqual([]);
  });

  it("skips weighted items but compares items without a unit price", () => {
    const weighted = order("2026-07-09", [item("1", { itemUnitPriceAmount: 2 })]);
    const noUnitPrice = order("2026-07-09", [item("2", { itemUnitPriceAmount: null })]);

    expect(
      findPriceMatches([weighted, noUnitPrice], products({ "1": 1, "2": 9 }), now),
    ).toMatchObject([{ order: noUnitPrice }]);
  });

  it("skips missing product details and unavailable list prices", () => {
    const receipt = order("2026-07-09", [item("1"), item("2")]);

    expect(findPriceMatches([receipt], products({ "2": null }), now)).toEqual([]);
  });

  it("skips equal or higher new prices", () => {
    const receipt = order("2026-07-09", [item("1"), item("2")]);

    expect(findPriceMatches([receipt], products({ "1": 10, "2": 11 }), now)).toEqual([]);
  });

  it("merges identical item lines and keeps differently priced lines separate", () => {
    const first = item("1", { amount: 10, discount: -1 });
    const duplicate = item("1", { amount: 10, discount: -1 });
    const differentPrice = item("1", { amount: 12, discount: -1, itemUnitPriceAmount: 12 });
    const receipt = order("2026-07-09", [first, duplicate, differentPrice]);

    expect(findPriceMatches([receipt], products({ "1": 8 }), now)[0].items).toMatchObject([
      { item: first, quantity: 2, oldPrice: 9, newPrice: 8 },
      { item: differentPrice, quantity: 1, oldPrice: 11, newPrice: 8 },
    ]);
  });

  it("sorts matching orders newest first", () => {
    const oldOrder = order("2026-06-10", [item("1")]);
    const newOrder = order("2026-07-09", [item("2")]);

    expect(
      findPriceMatches([oldOrder, newOrder], products({ "1": 9, "2": 9 }), now).map(
        ({ order }) => order,
      ),
    ).toEqual([newOrder, oldOrder]);
  });
});

describe("price-match helpers", () => {
  it("identifies only non-null, different unit and line prices as weighted", () => {
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: 2 })).toBe(true);
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: 10 })).toBe(false);
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: null })).toBe(false);
  });

  it("calculates the historical price after the order discount", () => {
    expect(historicalItemPrice({ amount: 10, discount: -2 })).toBe(8);
  });
});
