import { describe, expect, it } from "vitest";
import type { MergedReceipt, MergedReceiptItem, ProductDetail } from "../../common/client";
import type { PricingLookup, PricingResolution } from "../../common/current-pricing";
import { buildWarehouseDealIndex } from "../../common/warehouse-deals";
import type { DealOffer, WarehouseDeal } from "../../common/warehouse-savings";
import {
  findPriceAdjustments,
  historicalItemPrice,
  isWeightedItem,
  priceAdjustmentItemNumbers,
} from "./price-adjustment";

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

function product(itemNumber: string, price: number, listPrice: number): ProductDetail {
  return { itemNumber, itemActualName: itemNumber, price, listPrice } as ProductDetail;
}

function pricing(
  deals: WarehouseDeal[] = [],
  products: Record<string, ProductDetail> = {},
): PricingLookup {
  const index = buildWarehouseDealIndex(deals);
  return {
    warehouseSavingsAvailable: true,
    resolve(itemNumber): PricingResolution {
      const matched = index.get(itemNumber);
      if (matched) return { source: "warehouse_savings", deals: matched };
      const fallback = products[itemNumber];
      return fallback
        ? { source: "product_api_fallback", product: fallback }
        : { source: "unavailable", reason: "missing_product" };
    },
  };
}

describe("findPriceAdjustments", () => {
  it("uses an exact campaign final price", () => {
    const receipt = order("2026-07-09", [item("1", { amount: 10, discount: -2 })]);
    expect(findPriceAdjustments([receipt], pricing([finalDeal("1", 700, 300)]), now)).toMatchObject(
      [
        {
          items: [
            {
              source: "warehouse_savings",
              oldPrice: 8,
              newPrice: 7,
              adjustment: 1,
              campaignSaving: 3,
              calculationMode: "exact_final",
              estimated: false,
            },
          ],
        },
      ],
    );
  });

  it("uses displayed and saving-only campaign prices", () => {
    const displayed = deal("1", {
      kind: "displayed_price_only",
      price: { currency: "USD", cents: 899 },
      raw,
    });
    const saving = deal("2", { kind: "saving_only", saving: { currency: "USD", cents: 300 }, raw });
    const receipt = order("2026-07-09", [item("1"), item("2", { discount: -2 })]);
    expect(
      findPriceAdjustments([receipt], pricing([displayed, saving]), now)[0].items,
    ).toMatchObject([
      { newPrice: 8.99, calculationMode: "displayed_price", estimated: false },
      {
        oldPrice: 8,
        newPrice: 7,
        adjustment: 1,
        calculationMode: "inferred_saving",
        estimated: true,
      },
    ]);
  });

  it("uses a strict Product API fallback for a missing page item", () => {
    const receipt = order("2026-07-09", [item("1", { amount: 12.99, itemUnitPriceAmount: 12.99 })]);
    const result = findPriceAdjustments(
      [receipt],
      pricing([], { "1": product("1", 12.99, 9.49) }),
      now,
    );
    expect(result[0].items[0]).toMatchObject({
      source: "product_api_fallback",
      newPrice: 9.49,
      adjustment: 3.5,
      campaignSaving: 3.5,
      calculationMode: "product_api_fallback",
    });
  });

  it("does not let API fallback override an ambiguous page offer", () => {
    const range = deal("1", {
      kind: "saving_range",
      minSaving: { currency: "USD", cents: 100 },
      maxSaving: { currency: "USD", cents: 300 },
      raw,
    });
    const receipt = order("2026-07-09", [item("1")]);
    expect(
      findPriceAdjustments([receipt], pricing([range], { "1": product("1", 10, 5) }), now),
    ).toEqual([]);
  });

  it("allows fallback when the page deal is online-only", () => {
    const online = { ...finalDeal("1", 500), applicability: "online_only" as const };
    const receipt = order("2026-07-09", [item("1")]);
    expect(
      findPriceAdjustments([receipt], pricing([online], { "1": product("1", 10, 8) }), now)[0]
        .items[0].source,
    ).toBe("product_api_fallback");
  });

  it("skips API prices that do not beat the historical paid price", () => {
    const receipt = order("2026-07-09", [item("1", { discount: -2 })]);
    expect(findPriceAdjustments([receipt], pricing([], { "1": product("1", 10, 9) }), now)).toEqual(
      [],
    );
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
    const orders = [older, boundary, refund, gas, weighted, newest];
    const result = findPriceAdjustments(orders, pricing(deals), now);
    expect(result.map(({ order: matched }) => matched)).toEqual([newest, boundary]);
    expect(result[0].items[0]).toMatchObject({ item: duplicate, quantity: 2 });
    expect(priceAdjustmentItemNumbers(orders, now).sort()).toEqual(["1", "2"]);
  });
});

describe("price-adjustment helpers", () => {
  it("identifies weighted items and calculates historical net price", () => {
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: 2 })).toBe(true);
    expect(isWeightedItem({ amount: 10, itemUnitPriceAmount: null })).toBe(false);
    expect(historicalItemPrice({ amount: 10, discount: -2 })).toBe(8);
  });
});
