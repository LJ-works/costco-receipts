import { describe, expect, it } from "vitest";
import type { MergedReceipt, MergedReceiptItem } from "../../common/client";
import type { DealOffer, WarehouseDeal } from "../../common/warehouse-savings";
import { findPriceAdjustments, historicalItemPrice, isWeightedItem } from "./price-adjustment";

const now = new Date("2026-07-09T12:00:00");
const raw = { prependText: "", values: [], appendText: "", displayText: "deal" };

function item(itemNumber: string, partial: Partial<MergedReceiptItem> = {}): MergedReceiptItem {
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
  partial: Partial<MergedReceipt> = {},
): MergedReceipt {
  return {
    transactionDate,
    itemArray,
    receiptType: "In-Warehouse",
    transactionType: "Sales",
    ...partial,
  } as MergedReceipt;
}

function deal(
  itemNumber: string | null,
  offer: DealOffer,
  applicability: WarehouseDeal["applicability"] = "warehouse_only",
): WarehouseDeal {
  return {
    category: "Grocery",
    title: `Item ${itemNumber}`,
    itemNumber,
    productId: null,
    couponType: "item",
    applicability,
    url: null,
    imageUrl: null,
    offerDetails: null,
    offerTerms: null,
    additionalText: null,
    offer,
  };
}

function finalDeal(itemNumber: string, finalCents: number, savingCents = 100): WarehouseDeal {
  return deal(itemNumber, {
    kind: "final_price_after_discount",
    finalPrice: { currency: "USD", cents: finalCents },
    saving: { currency: "USD", cents: savingCents },
    regularPrice: { currency: "USD", cents: finalCents + savingCents },
    regularPriceDerived: true,
    raw,
  });
}

describe("findPriceAdjustments", () => {
  it("uses an exact campaign final price", () => {
    const receipt = order("2026-07-09", [item("1", { amount: 10, discount: -2 })]);
    expect(findPriceAdjustments([receipt], [finalDeal("1", 700, 300)], now)).toMatchObject([
      {
        items: [
          {
            oldPrice: 8,
            newPrice: 7,
            adjustment: 1,
            campaignSaving: 3,
            calculationMode: "exact_final",
            estimated: false,
          },
        ],
      },
    ]);
  });

  it("uses a single displayed campaign price", () => {
    const receipt = order("2026-07-09", [item("1")]);
    const displayed = deal("1", {
      kind: "displayed_price_only",
      price: { currency: "USD", cents: 899 },
      raw,
    });
    expect(findPriceAdjustments([receipt], [displayed], now)[0].items[0]).toMatchObject({
      newPrice: 8.99,
      adjustment: 1.01,
      calculationMode: "displayed_price",
      estimated: false,
    });
  });

  it("infers a saving-only price and accounts for the discount already received", () => {
    const receipt = order("2026-07-09", [item("1", { amount: 10, discount: -2 })]);
    const saving = deal("1", {
      kind: "saving_only",
      saving: { currency: "USD", cents: 300 },
      raw,
    });
    expect(findPriceAdjustments([receipt], [saving], now)[0].items[0]).toMatchObject({
      oldPrice: 8,
      newPrice: 7,
      adjustment: 1,
      campaignSaving: 3,
      calculationMode: "inferred_saving",
      estimated: true,
    });
  });

  it("skips an equal or smaller campaign saving", () => {
    const receipt = order("2026-07-09", [item("1", { discount: -2 })]);
    const equal = deal("1", {
      kind: "saving_only",
      saving: { currency: "USD", cents: 200 },
      raw,
    });
    expect(findPriceAdjustments([receipt], [equal], now)).toEqual([]);
  });

  it("skips missing, online-only, ranged, and conflicting deals", () => {
    const receipt = order("2026-07-09", [item("1"), item("2"), item("3"), item("4")]);
    const online = { ...finalDeal("2", 500), applicability: "online_only" as const };
    const range = deal("3", {
      kind: "saving_range",
      minSaving: { currency: "USD", cents: 100 },
      maxSaving: { currency: "USD", cents: 300 },
      raw,
    });
    const conflicting = [finalDeal("4", 500), finalDeal("4", 600)];
    expect(findPriceAdjustments([receipt], [online, range, ...conflicting], now)).toEqual([]);
  });

  it("retains date, sale, weighted-item, merge, and sorting rules", () => {
    const duplicate = item("1");
    const newest = order("2026-07-09", [duplicate, item("1")]);
    const boundary = order("2026-06-09", [item("2")]);
    const older = order("2026-06-08", [item("3")]);
    const refund = order("2026-07-09", [item("4")], { transactionType: "Refund" });
    const gas = order("2026-07-09", [item("5")], { receiptType: "Gas Station" });
    const weighted = order("2026-07-09", [item("6", { itemUnitPriceAmount: 2 })]);
    const deals = ["1", "2", "3", "4", "5", "6"].map((id) => finalDeal(id, 900));

    const result = findPriceAdjustments(
      [older, boundary, refund, gas, weighted, newest],
      deals,
      now,
    );
    expect(result.map(({ order: matched }) => matched)).toEqual([newest, boundary]);
    expect(result[0].items[0]).toMatchObject({ item: duplicate, quantity: 2 });
  });
});

describe("price-adjustment helpers", () => {
  it("identifies weighted items", () => {
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: 2 })).toBe(true);
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: 10 })).toBe(false);
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: null })).toBe(false);
  });

  it("calculates the historical net price", () => {
    expect(historicalItemPrice({ amount: 10, discount: -2 })).toBe(8);
  });
});
