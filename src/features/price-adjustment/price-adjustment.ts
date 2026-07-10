import type {
  MergedReceipt,
  MergedReceiptItem,
  ProductDetail,
  ProductDetailMap,
} from "../../common/client";

export const PRICE_ADJUSTMENT_DAYS = 30;

export interface PriceAdjustmentItem {
  item: MergedReceiptItem;
  product: ProductDetail;
  quantity: number;
  oldPrice: number;
  newPrice: number;
}

export interface PriceAdjustmentOrder {
  order: MergedReceipt;
  items: PriceAdjustmentItem[];
}

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isWeightedItem(
  item: Pick<MergedReceiptItem, "amount" | "itemUnitPriceAmount">,
): boolean {
  return item.itemUnitPriceAmount !== null && item.itemUnitPriceAmount !== item.amount;
}

export function historicalItemPrice(item: Pick<MergedReceiptItem, "amount" | "discount">): number {
  return item.amount + item.discount;
}

function isWarehouseSale(order: MergedReceipt): boolean {
  return order.receiptType === "In-Warehouse" && order.transactionType !== "Refund";
}

function mergeKey(item: MergedReceiptItem): string {
  return JSON.stringify([item.itemNumber, item.amount, item.discount, item.itemUnitPriceAmount]);
}

export function findPriceAdjustments(
  orders: MergedReceipt[],
  products: ProductDetailMap,
  now: Date,
  recentDays = PRICE_ADJUSTMENT_DAYS,
): PriceAdjustmentOrder[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - recentDays);
  const cutoffDate = formatLocalDate(cutoff);
  const adjustments: PriceAdjustmentOrder[] = [];

  for (const order of orders) {
    if (order.transactionDate < cutoffDate || !isWarehouseSale(order)) continue;

    const mergedItems = new Map<string, PriceAdjustmentItem>();

    for (const item of order.itemArray) {
      const product = products[item.itemNumber];
      if (!product || isWeightedItem(item) || product.listPrice === null) continue;

      const oldPrice = historicalItemPrice(item);
      const newPrice = product.listPrice;
      if (newPrice >= oldPrice) continue;

      const key = mergeKey(item);
      const existing = mergedItems.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        mergedItems.set(key, { item, product, quantity: 1, oldPrice, newPrice });
      }
    }

    const items = [...mergedItems.values()];
    if (items.length > 0) adjustments.push({ order, items });
  }

  return adjustments.sort((a, b) => b.order.transactionDate.localeCompare(a.order.transactionDate));
}
