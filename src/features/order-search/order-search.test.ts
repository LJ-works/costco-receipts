import { describe, expect, it } from "vitest";
import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "../../common/client";
import { searchOrdersByProductText } from "./order-search";

function item(
  itemNumber: string,
  descriptions: Partial<
    Pick<
      MergedReceiptItem,
      | "itemDescription01"
      | "itemDescription02"
      | "frenchItemDescription1"
      | "frenchItemDescription2"
    >
  > = {},
): MergedReceiptItem {
  return {
    itemNumber,
    itemDescription01: null,
    itemDescription02: null,
    frenchItemDescription1: null,
    frenchItemDescription2: null,
    amount: 10,
    discount: 0,
    itemIdentifier: null,
    itemDepartmentNumber: null,
    unit: 1,
    taxFlag: null,
    merchantID: null,
    entryMethod: null,
    transDepartmentNumber: null,
    fuelUnitQuantity: null,
    fuelGradeCode: null,
    itemUnitPriceAmount: null,
    fuelUomCode: null,
    fuelUomDescription: null,
    fuelUomDescriptionFr: null,
    fuelGradeDescription: null,
    fuelGradeDescriptionFr: null,
    ...descriptions,
  };
}

function order(transactionDate: string, items: MergedReceiptItem[]): MergedReceipt {
  return { transactionDate, itemArray: items } as MergedReceipt;
}

function products(names: Record<string, string>): ProductDetailMap {
  return Object.fromEntries(
    Object.entries(names).map(([itemNumber, itemActualName]) => [
      itemNumber,
      { itemNumber, itemActualName },
    ]),
  ) as ProductDetailMap;
}

describe("searchOrdersByProductText", () => {
  it("matches ProductDetail.itemActualName instead of requiring the order description", () => {
    const receipt = order("2026-07-01", [item("1", { itemDescription01: "UNRELATED" })]);

    expect(
      searchOrdersByProductText([receipt], products({ "1": "Organic Bananas" }), "banana"),
    ).toMatchObject([{ order: receipt, matchedItemNumbers: ["1"] }]);
  });

  it("also matches order item descriptions when a different product name is cached", () => {
    const receipt = order("2026-07-01", [item("1", { itemDescription01: "KIRKLAND ALMONDS" })]);

    expect(
      searchOrdersByProductText([receipt], products({ "1": "Mixed Nuts" }), "almond"),
    ).toMatchObject([{ order: receipt, matchedItemNumbers: ["1"] }]);
  });

  it("matches order item descriptions when product details are missing", () => {
    const receipt = order("2026-07-01", [item("1", { itemDescription01: "FRESH MILK" })]);

    expect(searchOrdersByProductText([receipt], {}, "milk")).toHaveLength(1);
  });

  it("matches every keyword as a partial match, regardless of order", () => {
    const receipt = order("2026-07-01", [item("1")]);
    const productMap = products({ "1": "Dark Baking Chip" });

    expect(searchOrdersByProductText([receipt], productMap, "dark chip")).toHaveLength(1);
    expect(searchOrdersByProductText([receipt], productMap, "dar chi")).toHaveLength(1);
    expect(searchOrdersByProductText([receipt], productMap, "chip dark")).toHaveLength(1);
  });

  it("requires every keyword to match the same product", () => {
    const receipt = order("2026-07-01", [
      item("1", { itemDescription01: "DARK CHOCOLATE" }),
      item("2", { itemDescription01: "POTATO CHIPS" }),
    ]);

    expect(searchOrdersByProductText([receipt], {}, "dark chip")).toEqual([]);
  });

  it("matches name keywords case-insensitively", () => {
    const receipt = order("2026-07-01", [item("1")]);

    expect(
      searchOrdersByProductText([receipt], products({ "1": "Chocolate Cookies" }), "ATE coo"),
    ).toHaveLength(1);
  });

  it("matches an item number only when the full id is entered", () => {
    const receipt = order("2026-07-01", [item("12345")]);

    expect(searchOrdersByProductText([receipt], {}, "12345")).toHaveLength(1);
    expect(searchOrdersByProductText([receipt], {}, "123")).toEqual([]);
  });

  it("deduplicates matched item numbers and each matching order", () => {
    const receipt = order("2026-07-01", [
      item("1", { itemDescription01: "APPLE" }),
      item("1", { itemDescription01: "APPLE" }),
      item("2", { itemDescription01: "APPLE PIE" }),
    ]);

    expect(searchOrdersByProductText([receipt], {}, "apple")).toEqual([
      { order: receipt, matchedItemNumbers: ["1", "2"] },
    ]);
  });

  it("returns no matches for an empty query", () => {
    expect(searchOrdersByProductText([order("2026-07-01", [item("1")])], {}, "  ")).toEqual([]);
  });

  it("sorts matching orders newest first", () => {
    const oldOrder = order("2026-05-01", [item("1", { itemDescription01: "APPLE" })]);
    const newOrder = order("2026-07-01", [item("2", { itemDescription01: "APPLE" })]);

    expect(
      searchOrdersByProductText([oldOrder, newOrder], {}, "apple").map(({ order }) => order),
    ).toEqual([newOrder, oldOrder]);
  });
});
