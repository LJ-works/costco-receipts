import { describe, expect, it } from "vitest";
import { extractWarehouses, loadSelectedWarehouse, saveSelectedWarehouse } from "./warehouses";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

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

describe("loadSelectedWarehouse / saveSelectedWarehouse", () => {
  it("returns null when nothing is stored", () => {
    expect(loadSelectedWarehouse(fakeStorage())).toBeNull();
  });

  it("round-trips a saved warehouse", () => {
    const storage = fakeStorage();
    saveSelectedWarehouse({ id: 423, name: "SUNNYVALE" }, storage);
    expect(loadSelectedWarehouse(storage)).toEqual({ id: 423, name: "SUNNYVALE" });
  });

  it("returns null for corrupted or malformed stored content", () => {
    expect(
      loadSelectedWarehouse(fakeStorage({ "costco-userjs:selected-warehouse": "not json" })),
    ).toBeNull();
    expect(
      loadSelectedWarehouse(fakeStorage({ "costco-userjs:selected-warehouse": '{"id":"423"}' })),
    ).toBeNull();
  });
});
