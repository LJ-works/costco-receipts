import { describe, expect, it, vi } from "vitest";
import type { ProductDetail } from "./client";
import { CurrentPricingContext, isProductApiDiscount } from "./current-pricing";
import type { WarehouseDeal } from "./warehouse-savings";

function product(
  itemNumber: string,
  price: number | null,
  listPrice: number | null,
): ProductDetail {
  return {
    itemNumber,
    itemActualName: itemNumber,
    fullItemImage: "",
    catEntryId: "",
    published: true,
    price,
    listPrice,
    programTypes: [],
    minItemOrderQty: null,
    fsa: null,
    chdIndicator: null,
    replacedItem: null,
    replacementType: null,
  };
}

function deal(
  itemNumber: string,
  applicability: WarehouseDeal["applicability"] = "warehouse_only",
): WarehouseDeal {
  return {
    category: "Test",
    title: itemNumber,
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
      raw: { prependText: "", values: [], appendText: "", displayText: "Range" },
    },
  };
}

describe("CurrentPricingContext", () => {
  it("keeps Warehouse Savings authoritative and does not fetch covered items", async () => {
    const fetchProducts = vi.fn().mockResolvedValue({});
    const context = new CurrentPricingContext([deal("1")], {
      clientId: "client",
      warehouseNumber: "847",
      fetchProducts,
    });
    await context.ensureFallback(["1"]);
    expect(fetchProducts).not.toHaveBeenCalled();
    expect(context.resolve("1").source).toBe("warehouse_savings");
  });

  it("allows fallback when the only page deal is online-only", async () => {
    const fetchProducts = vi.fn().mockResolvedValue({ "1": product("1", 10, 8) });
    const context = new CurrentPricingContext([deal("1", "online_only")], {
      clientId: "client",
      warehouseNumber: "847",
      fetchProducts,
    });
    await context.ensureFallback(["1"]);
    expect(context.resolve("1")).toMatchObject({ source: "product_api_fallback" });
  });

  it("strictly validates API discounts", async () => {
    const fetchProducts = vi.fn().mockResolvedValue({
      "1": product("1", 10, 8),
      "2": product("2", 10, 10),
      "3": product("3", null, 8),
    });
    const context = new CurrentPricingContext([], {
      clientId: "client",
      warehouseNumber: "847",
      fetchProducts,
    });
    await context.ensureFallback(["1", "2", "3"]);
    expect(context.resolve("1").source).toBe("product_api_fallback");
    expect(context.resolve("2")).toEqual({ source: "unavailable", reason: "no_discount" });
    expect(context.resolve("3")).toEqual({ source: "unavailable", reason: "no_discount" });
  });

  it("deduplicates repeated and concurrent fallback requests", async () => {
    let finish: (value: Record<string, ProductDetail>) => void = () => undefined;
    const fetchProducts = vi.fn().mockReturnValue(
      new Promise<Record<string, ProductDetail>>((resolve) => {
        finish = resolve;
      }),
    );
    const context = new CurrentPricingContext([], {
      clientId: "client",
      warehouseNumber: "847",
      fetchProducts,
    });
    const first = context.ensureFallback(["1", "1"]);
    const second = context.ensureFallback(["1"]);
    finish({ "1": product("1", 10, 8) });
    await Promise.all([first, second]);
    await context.ensureFallback(["1"]);
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });

  it("marks a failed request unavailable without retrying in the same session", async () => {
    const fetchProducts = vi.fn().mockRejectedValue(new Error("network"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = new CurrentPricingContext([], {
      clientId: "client",
      warehouseNumber: "847",
      fetchProducts,
    });
    await context.ensureFallback(["1"]);
    await context.ensureFallback(["1"]);
    expect(context.resolve("1")).toEqual({ source: "unavailable", reason: "missing_product" });
    expect(fetchProducts).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("falls back for all requested items when Warehouse Savings failed", async () => {
    const fetchProducts = vi.fn().mockResolvedValue({ "1": product("1", 10, 8) });
    const context = new CurrentPricingContext(null, {
      clientId: "client",
      warehouseNumber: "847",
      fetchProducts,
    });
    await context.ensureFallback(["1"]);
    expect(context.warehouseSavingsAvailable).toBe(false);
    expect(context.resolve("1").source).toBe("product_api_fallback");
  });
});

describe("isProductApiDiscount", () => {
  it("requires finite regular and lower list prices", () => {
    expect(isProductApiDiscount({ price: 10, listPrice: 8 })).toBe(true);
    expect(isProductApiDiscount({ price: 10, listPrice: 10 })).toBe(false);
    expect(isProductApiDiscount({ price: 10, listPrice: null })).toBe(false);
    expect(isProductApiDiscount({ price: Number.NaN, listPrice: 8 })).toBe(false);
  });
});
