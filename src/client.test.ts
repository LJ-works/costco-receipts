import { describe, expect, it } from "vitest";
import { mergeReceiptItemDiscounts, type ReceiptItem } from "./client";

// Fill only the fields relevant to the test; Partial supplies the rest without strict fixtures.
function item(
  partial: Partial<ReceiptItem> & Pick<ReceiptItem, "itemNumber" | "amount">,
): ReceiptItem {
  return {
    itemDescription01: null,
    frenchItemDescription1: null,
    itemDescription02: null,
    frenchItemDescription2: null,
    itemIdentifier: null,
    itemDepartmentNumber: null,
    unit: null,
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
    ...partial,
  };
}

describe("mergeReceiptItemDiscounts", () => {
  it("folds a discount line into its target product", () => {
    const merged = mergeReceiptItemDiscounts([
      item({ itemNumber: "30669", itemDescription01: "BANANAS", amount: 1.99 }),
      item({ itemNumber: "27003", itemDescription01: "STRAWBERRIES", amount: 4.99 }),
      item({
        itemNumber: "384633",
        itemDescription01: "/ 27003",
        frenchItemDescription1: "/27003",
        amount: -1,
      }),
    ]);

    expect(merged).toHaveLength(2);

    const strawberries = merged.find((i) => i.itemNumber === "27003");
    expect(strawberries?.amount).toBe(4.99); // Original price remains unchanged.
    expect(strawberries?.discount).toBe(-1);

    const bananas = merged.find((i) => i.itemNumber === "30669");
    expect(bananas?.discount).toBe(0);
  });
});
