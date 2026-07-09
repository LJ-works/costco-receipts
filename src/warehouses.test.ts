import { describe, expect, it } from "vitest";
import { extractWarehouses, formatWarehouseList } from "./warehouses";

describe("extractWarehouses", () => {
  it("dedupes by warehouseNumber, keeping first name and visit order", () => {
    const warehouses = extractWarehouses([
      { warehouseName: "SEATTLE", warehouseNumber: 1 },
      { warehouseName: "BELLEVUE", warehouseNumber: 2 },
      { warehouseName: "SEATTLE", warehouseNumber: 1 },
    ]);

    expect(warehouses).toEqual([
      { id: 1, name: "SEATTLE" },
      { id: 2, name: "BELLEVUE" },
    ]);
  });
});

describe("formatWarehouseList", () => {
  it("lists name and id per warehouse", () => {
    expect(formatWarehouseList([{ id: 649, name: "SEATTLE" }])).toContain("SEATTLE (#649)");
  });

  it("returns a fallback message for an empty list", () => {
    expect(formatWarehouseList([])).toContain("没有");
  });
});
