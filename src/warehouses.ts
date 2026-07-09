import type { Receipt } from "./client";

export interface WarehouseVisit {
  id: number;
  name: string;
}

/** Dedupe by warehouseNumber, keeping the name from the first occurrence and the order of first visit. */
export function extractWarehouses(
  receipts: readonly Pick<Receipt, "warehouseName" | "warehouseNumber">[],
): WarehouseVisit[] {
  const seen = new Map<number, string>();
  for (const receipt of receipts) {
    if (!seen.has(receipt.warehouseNumber)) {
      seen.set(receipt.warehouseNumber, receipt.warehouseName);
    }
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

const STORAGE_KEY = "costco-userjs:selected-warehouse";

export function loadSelectedWarehouse(
  storage: Pick<Storage, "getItem"> = localStorage,
): WarehouseVisit | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.id === "number" && typeof parsed?.name === "string") return parsed;
  } catch {
    // 忽略损坏的存储内容
  }
  return null;
}

export function saveSelectedWarehouse(
  warehouse: WarehouseVisit,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(warehouse));
}
