import type { MergedReceipt, MergedReceiptItem } from "../../common/client";
import {
  buildWarehouseDealIndex,
  selectExactWarehouseDeal,
  type ExactWarehouseDeal,
} from "../../common/warehouse-deals";
import type { WarehouseDeal } from "../../common/warehouse-savings";

export const PRICE_ADJUSTMENT_DAYS = 30;

export type PriceCalculationMode = "exact_final" | "displayed_price" | "inferred_saving";

export interface PriceAdjustmentItem {
  item: MergedReceiptItem;
  deal: ExactWarehouseDeal;
  quantity: number;
  oldPrice: number;
  newPrice: number;
  adjustment: number;
  campaignSaving: number | null;
  calculationMode: PriceCalculationMode;
  estimated: boolean;
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
  deals: readonly WarehouseDeal[],
  now: Date,
  recentDays = PRICE_ADJUSTMENT_DAYS,
): PriceAdjustmentOrder[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - recentDays);
  const cutoffDate = formatLocalDate(cutoff);
  const dealIndex = buildWarehouseDealIndex(deals);
  const adjustments: PriceAdjustmentOrder[] = [];

  for (const order of orders) {
    if (order.transactionDate < cutoffDate || !isWarehouseSale(order)) continue;

    const mergedItems = new Map<string, PriceAdjustmentItem>();
    for (const item of order.itemArray) {
      if (isWeightedItem(item)) continue;
      const deal = selectExactWarehouseDeal(dealIndex.get(item.itemNumber));
      if (!deal) continue;
      const adjustment = calculateAdjustment(item, deal);
      if (!adjustment) continue;

      const key = mergeKey(item);
      const existing = mergedItems.get(key);
      if (existing) existing.quantity += 1;
      else mergedItems.set(key, adjustment);
    }

    const items = [...mergedItems.values()];
    if (items.length > 0) adjustments.push({ order, items });
  }

  return adjustments.sort((a, b) => b.order.transactionDate.localeCompare(a.order.transactionDate));
}

function calculateAdjustment(
  item: MergedReceiptItem,
  deal: ExactWarehouseDeal,
): PriceAdjustmentItem | null {
  const grossCents = dollarsToCents(item.amount);
  const oldPriceCents = dollarsToCents(historicalItemPrice(item));
  let newPriceCents: number;
  let campaignSavingCents: number | null = null;
  let calculationMode: PriceCalculationMode;
  let estimated = false;

  if (deal.offer.kind === "final_price_after_discount") {
    newPriceCents = deal.offer.finalPrice.cents;
    campaignSavingCents = deal.offer.saving.cents;
    calculationMode = "exact_final";
  } else if (deal.offer.kind === "displayed_price_only") {
    newPriceCents = deal.offer.price.cents;
    calculationMode = "displayed_price";
  } else {
    const historicalSavingCents = Math.max(0, -dollarsToCents(item.discount));
    campaignSavingCents = deal.offer.saving.cents;
    if (campaignSavingCents <= historicalSavingCents) return null;
    newPriceCents = grossCents - campaignSavingCents;
    if (newPriceCents < 0) return null;
    calculationMode = "inferred_saving";
    estimated = true;
  }

  if (newPriceCents >= oldPriceCents) return null;
  return {
    item,
    deal,
    quantity: 1,
    oldPrice: oldPriceCents / 100,
    newPrice: newPriceCents / 100,
    adjustment: (oldPriceCents - newPriceCents) / 100,
    campaignSaving: campaignSavingCents === null ? null : campaignSavingCents / 100,
    calculationMode,
    estimated,
  };
}

function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}
