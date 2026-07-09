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

export function formatWarehouseList(warehouses: WarehouseVisit[]): string {
  if (warehouses.length === 0) return "过去 100 天内没有 warehouse 消费记录。";
  const lines = warehouses.map((w) => `${w.name} (#${w.id})`);
  return `过去 100 天去过的 warehouse：\n${lines.join("\n")}`;
}
