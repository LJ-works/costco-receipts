import { describe, expect, it } from "vitest";
import type { DealOffer, WarehouseDeal } from "./warehouse-savings";
import {
  activeWatchedItemNumbers,
  buildWarehouseDealIndex,
  selectExactWarehouseDeal,
} from "./warehouse-deals";

const raw = { prependText: "", values: [], appendText: "", displayText: "" };

function deal(
  itemNumber: string | null,
  offer: DealOffer,
  applicability: WarehouseDeal["applicability"] = "warehouse_only",
): WarehouseDeal {
  return {
    category: "Test",
    title: "Test",
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

function final(itemNumber: string, cents: number): WarehouseDeal {
  return deal(itemNumber, {
    kind: "final_price_after_discount",
    finalPrice: { currency: "USD", cents },
    saving: { currency: "USD", cents: 100 },
    regularPrice: { currency: "USD", cents: cents + 100 },
    regularPriceDerived: true,
    raw,
  });
}

describe("warehouse deal lookup", () => {
  it("indexes warehouse deals by item number and excludes online-only/missing IDs", () => {
    const index = buildWarehouseDealIndex([
      final("1", 500),
      { ...final("2", 500), applicability: "warehouse_online" },
      { ...final("3", 500), applicability: "online_only" },
      deal(null, { kind: "unstructured", raw }),
    ]);
    expect([...index.keys()]).toEqual(["1", "2"]);
  });

  it("prefers an exact final price and rejects conflicting preferred offers", () => {
    const saving = deal("1", {
      kind: "saving_only",
      saving: { currency: "USD", cents: 100 },
      raw,
    });
    expect(selectExactWarehouseDeal([saving, final("1", 500)])?.offer.kind).toBe(
      "final_price_after_discount",
    );
    expect(selectExactWarehouseDeal([final("1", 500), final("1", 600)])).toBeNull();
  });

  it("returns unique active watched item numbers", () => {
    const index = buildWarehouseDealIndex([final("1", 500)]);
    expect(activeWatchedItemNumbers(["1", "1", "2"], index)).toEqual(["1"]);
  });
});
