import type { MergedReceipt, MergedReceiptItem, ProductDetail } from "../../common/client";
import type { PricingLookup } from "../../common/current-pricing";
import { selectExactWarehouseDeal, type ExactWarehouseDeal } from "../../common/warehouse-deals";

export const PRICE_ADJUSTMENT_DAYS = 30;

export type PriceCalculationMode =
  | "exact_final"
  | "displayed_price"
  | "inferred_saving"
  | "product_api_fallback";

export interface PriceAdjustmentItem {
  item: MergedReceiptItem;
  source: "warehouse_savings" | "product_api_fallback";
  deal: ExactWarehouseDeal | null;
  fallbackProduct: ProductDetail | null;
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

export function priceAdjustmentItemNumbers(
  orders: readonly MergedReceipt[],
  now: Date,
  recentDays = PRICE_ADJUSTMENT_DAYS,
): string[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - recentDays);
  const cutoffDate = formatLocalDate(cutoff);
  const result = new Set<string>();
  for (const order of orders) {
    if (order.transactionDate < cutoffDate || !isWarehouseSale(order)) continue;
    for (const item of order.itemArray) {
      if (!isWeightedItem(item)) result.add(item.itemNumber);
    }
  }
  return [...result];
}

export function findPriceAdjustments(
  orders: MergedReceipt[],
  pricing: PricingLookup,
  now: Date,
  recentDays = PRICE_ADJUSTMENT_DAYS,
): PriceAdjustmentOrder[] {
  const eligibleNumbers = new Set(priceAdjustmentItemNumbers(orders, now, recentDays));
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - recentDays);
  const cutoffDate = formatLocalDate(cutoff);
  const adjustments: PriceAdjustmentOrder[] = [];

  for (const order of orders) {
    if (order.transactionDate < cutoffDate || !isWarehouseSale(order)) continue;
    if (!order.itemArray.some((item) => eligibleNumbers.has(item.itemNumber))) continue;

    const mergedItems = new Map<string, PriceAdjustmentItem>();
    for (const item of order.itemArray) {
      if (!eligibleNumbers.has(item.itemNumber) || isWeightedItem(item)) continue;
      const resolution = pricing.resolve(item.itemNumber);
      let adjustment: PriceAdjustmentItem | null = null;
      if (resolution.source === "warehouse_savings") {
        const deal = selectExactWarehouseDeal(resolution.deals);
        if (deal) adjustment = calculateWarehouseAdjustment(item, deal);
      } else if (resolution.source === "product_api_fallback") {
        adjustment = calculateProductApiAdjustment(item, resolution.product);
      }
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

function calculateWarehouseAdjustment(
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
  return createAdjustment(item, oldPriceCents, newPriceCents, {
    source: "warehouse_savings",
    deal,
    fallbackProduct: null,
    campaignSavingCents,
    calculationMode,
    estimated,
  });
}

function calculateProductApiAdjustment(
  item: MergedReceiptItem,
  product: ProductDetail,
): PriceAdjustmentItem | null {
  if (
    product.price === null ||
    product.listPrice === null ||
    !Number.isFinite(product.price) ||
    !Number.isFinite(product.listPrice) ||
    product.listPrice >= product.price
  ) {
    return null;
  }
  const oldPriceCents = dollarsToCents(historicalItemPrice(item));
  const newPriceCents = dollarsToCents(product.listPrice);
  if (newPriceCents >= oldPriceCents) return null;
  return createAdjustment(item, oldPriceCents, newPriceCents, {
    source: "product_api_fallback",
    deal: null,
    fallbackProduct: product,
    campaignSavingCents: dollarsToCents(product.price) - newPriceCents,
    calculationMode: "product_api_fallback",
    estimated: false,
  });
}

function createAdjustment(
  item: MergedReceiptItem,
  oldPriceCents: number,
  newPriceCents: number,
  details: {
    source: PriceAdjustmentItem["source"];
    deal: ExactWarehouseDeal | null;
    fallbackProduct: ProductDetail | null;
    campaignSavingCents: number | null;
    calculationMode: PriceCalculationMode;
    estimated: boolean;
  },
): PriceAdjustmentItem {
  return {
    item,
    source: details.source,
    deal: details.deal,
    fallbackProduct: details.fallbackProduct,
    quantity: 1,
    oldPrice: oldPriceCents / 100,
    newPrice: newPriceCents / 100,
    adjustment: (oldPriceCents - newPriceCents) / 100,
    campaignSaving: details.campaignSavingCents === null ? null : details.campaignSavingCents / 100,
    calculationMode: details.calculationMode,
    estimated: details.estimated,
  };
}

function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}
