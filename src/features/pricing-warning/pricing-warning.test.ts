import { describe, expect, it } from "vitest";
import type { WarehouseDeal } from "../../common/warehouse-savings";
import {
  activeWatchlistItems,
  countActiveWatchlistDeals,
  loadWatchlist,
  normalizeItemNumber,
  saveWatchlist,
} from "./pricing-warning";

function deal(
  itemNumber: string,
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
    offer: {
      kind: "unstructured",
      raw: { prependText: "", values: [], appendText: "", displayText: "Member deal" },
    },
  };
}

describe("loadWatchlist / saveWatchlist", () => {
  it("round-trips a string array", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    saveWatchlist(["1", "2"], storage);
    expect(loadWatchlist(storage)).toEqual(["1", "2"]);
  });

  it("returns [] for missing or corrupted data", () => {
    expect(loadWatchlist({ getItem: () => null })).toEqual([]);
    expect(loadWatchlist({ getItem: () => "not json" })).toEqual([]);
    expect(loadWatchlist({ getItem: () => JSON.stringify({ nope: true }) })).toEqual([]);
    expect(loadWatchlist({ getItem: () => JSON.stringify(["1", 2, null]) })).toEqual(["1"]);
  });
});

describe("normalizeItemNumber", () => {
  it("accepts a trimmed digit string and rejects other input", () => {
    expect(normalizeItemNumber(" 123 ")).toBe("123");
    expect(normalizeItemNumber("12a")).toBeNull();
    expect(normalizeItemNumber("")).toBeNull();
  });
});

describe("Warehouse Savings watch status", () => {
  it("activates warehouse-only and warehouse-and-online deals", () => {
    const deals = [deal("1"), deal("2", "warehouse_online")];
    expect(activeWatchlistItems(["1", "2", "3"], deals)).toEqual(["1", "2"]);
    expect(countActiveWatchlistDeals(["1", "2", "3"], deals)).toBe(2);
  });

  it("does not activate online-only or absent items", () => {
    expect(activeWatchlistItems(["1", "2"], [deal("1", "online_only")])).toEqual([]);
  });

  it("counts each watched item once and accepts non-price campaign offers", () => {
    expect(countActiveWatchlistDeals(["1", "1"], [deal("1"), deal("1")])).toBe(1);
  });
});
