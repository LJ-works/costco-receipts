import { describe, expect, it } from "vitest";
import type { MergedReceiptItem } from "./client";
import { fallbackOrderItemName, formatMoney, orderItemNetAmount } from "./order";

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
    ...descriptions,
  } as MergedReceiptItem;
}

describe("order item helpers", () => {
  it("adds the order discount to the original amount", () => {
    expect(orderItemNetAmount({ amount: 12.99, discount: -3 })).toBeCloseTo(9.99);
  });

  it("formats positive and negative money with two decimal places", () => {
    expect(formatMoney(9.5)).toBe("$9.50");
    expect(formatMoney(-1.5)).toBe("-$1.50");
  });

  it("selects an order description and falls back to the item number", () => {
    expect(fallbackOrderItemName(item("1", { itemDescription02: "Second description" }))).toBe(
      "Second description",
    );
    expect(fallbackOrderItemName(item("42"))).toBe("Item #42");
  });
});
