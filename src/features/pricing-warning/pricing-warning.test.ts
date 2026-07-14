import { describe, expect, it } from "vitest";
import type { ProductDetail, ProductDetailMap } from "../../common/client";
import {
  countDiscounted,
  isDiscounted,
  loadWatchlist,
  normalizeItemNumber,
  saveWatchlist,
} from "./pricing-warning";

function product(price: number | null, listPrice: number | null): ProductDetail {
  return { itemNumber: "x", itemActualName: "x", price, listPrice } as ProductDetail;
}

function products(entries: Record<string, ProductDetail>): ProductDetailMap {
  return entries as ProductDetailMap;
}

describe("loadWatchlist / saveWatchlist", () => {
  it("round-trips a string array", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
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
  it("accepts a trimmed digit string", () => {
    expect(normalizeItemNumber("  123 ")).toBe("123");
  });

  it("rejects non-digit input", () => {
    expect(normalizeItemNumber("")).toBeNull();
    expect(normalizeItemNumber("12a")).toBeNull();
    expect(normalizeItemNumber("-1")).toBeNull();
  });
});

describe("isDiscounted", () => {
  it("is true only when listPrice is below price", () => {
    expect(isDiscounted(product(10, 8))).toBe(true);
    expect(isDiscounted(product(10, 10))).toBe(false);
    expect(isDiscounted(product(10, 12))).toBe(false);
    expect(isDiscounted(product(10, null))).toBe(false);
    expect(isDiscounted(product(null, 8))).toBe(false);
  });
});

describe("countDiscounted", () => {
  it("counts watchlist items that are discounted, ignoring missing", () => {
    const map = products({ "1": product(10, 8), "2": product(10, 10), "3": product(10, 5) });
    expect(countDiscounted(["1", "2", "3", "missing"], map)).toBe(2);
  });
});
