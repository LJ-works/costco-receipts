import { describe, expect, it } from "vitest";
import type { PricingLookup, PricingResolution } from "../../common/current-pricing";
import {
  activeWatchlistItems,
  addWatchlistItem,
  countActiveWatchlistDeals,
  loadWatchlist,
  normalizeItemNumber,
  saveWatchlist,
} from "./pricing-warning";

function pricing(resolutions: Record<string, PricingResolution>): PricingLookup {
  return {
    warehouseSavingsAvailable: true,
    resolve: (itemNumber) =>
      resolutions[itemNumber] ?? { source: "unavailable", reason: "missing_product" },
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

describe("addWatchlistItem", () => {
  it("adds a new item without mutating the original list", () => {
    const original = ["1"];
    expect(addWatchlistItem(original, "2")).toEqual({
      status: "added",
      watchlist: ["1", "2"],
    });
    expect(original).toEqual(["1"]);
  });

  it("keeps an existing item unchanged", () => {
    expect(addWatchlistItem(["1", "2"], "2")).toEqual({
      status: "already_watching",
      watchlist: ["1", "2"],
    });
  });

  it("allows the fiftieth item and rejects the fifty-first", () => {
    const first49 = Array.from({ length: 49 }, (_, index) => String(index + 1));
    const full = addWatchlistItem(first49, "50");
    expect(full.status).toBe("added");
    expect(full.watchlist).toHaveLength(50);
    expect(addWatchlistItem(full.watchlist, "51")).toEqual({
      status: "limit_reached",
      watchlist: full.watchlist,
    });
  });
});

describe("normalizeItemNumber", () => {
  it("accepts a trimmed digit string and rejects other input", () => {
    expect(normalizeItemNumber(" 123 ")).toBe("123");
    expect(normalizeItemNumber("12a")).toBeNull();
    expect(normalizeItemNumber("")).toBeNull();
  });
});

describe("current deal watch status", () => {
  const warehouse: PricingResolution = { source: "warehouse_savings", deals: [] };
  const fallback: PricingResolution = {
    source: "product_api_fallback",
    product: { itemNumber: "2", price: 10, listPrice: 8 } as never,
  };

  it("activates Warehouse Savings and Product API fallback deals", () => {
    const lookup = pricing({ "1": warehouse, "2": fallback });
    expect(activeWatchlistItems(["1", "2", "3"], lookup)).toEqual(["1", "2"]);
    expect(countActiveWatchlistDeals(["1", "2", "3"], lookup)).toBe(2);
  });

  it("keeps unavailable items inactive and counts duplicate watches once", () => {
    const lookup = pricing({ "1": warehouse });
    expect(activeWatchlistItems(["1", "1", "2"], lookup)).toEqual(["1"]);
    expect(countActiveWatchlistDeals(["1", "1", "2"], lookup)).toBe(1);
  });
});
