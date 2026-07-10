import type { MergedReceiptItem } from "./client";

export function orderItemDescriptions(item: MergedReceiptItem): string[] {
  return [
    item.itemDescription01,
    item.itemDescription02,
    item.frenchItemDescription1,
    item.frenchItemDescription2,
  ]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

export function fallbackOrderItemName(item: MergedReceiptItem): string {
  return orderItemDescriptions(item)[0] ?? `Item #${item.itemNumber}`;
}

export function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function orderItemNetAmount(item: Pick<MergedReceiptItem, "amount" | "discount">): number {
  return item.amount + item.discount;
}
