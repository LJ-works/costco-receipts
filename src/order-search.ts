import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "./client";

export interface OrderSearchMatch {
  order: MergedReceipt;
  matchedItemNumbers: string[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function nonEmptyTexts(values: (string | null | undefined)[]): string[] {
  return values.map((value) => value?.trim() ?? "").filter((value) => value.length > 0);
}

function orderItemDescriptions(item: MergedReceiptItem): string[] {
  return nonEmptyTexts([
    item.itemDescription01,
    item.itemDescription02,
    item.frenchItemDescription1,
    item.frenchItemDescription2,
  ]);
}

function searchableTexts(item: MergedReceiptItem, products: ProductDetailMap): string[] {
  return nonEmptyTexts([products[item.itemNumber]?.itemActualName, ...orderItemDescriptions(item)]);
}

export function fallbackOrderItemName(item: MergedReceiptItem): string {
  return orderItemDescriptions(item)[0] ?? `商品 #${item.itemNumber}`;
}

export function searchOrdersByProductText(
  orders: MergedReceipt[],
  products: ProductDetailMap,
  query: string,
): OrderSearchMatch[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];
  const keywords = normalizedQuery.split(/\s+/);

  const matches: OrderSearchMatch[] = [];

  for (const order of orders) {
    const matchedItemNumbers = new Set<string>();

    for (const item of order.itemArray) {
      const idMatched = normalizeText(item.itemNumber) === normalizedQuery;
      const normalizedTexts = searchableTexts(item, products).map(normalizeText);
      const keywordsMatched = keywords.every((keyword) =>
        normalizedTexts.some((text) => text.includes(keyword)),
      );
      if (idMatched || keywordsMatched) matchedItemNumbers.add(item.itemNumber);
    }

    if (matchedItemNumbers.size > 0) {
      matches.push({ order, matchedItemNumbers: [...matchedItemNumbers] });
    }
  }

  return matches.sort((a, b) => b.order.transactionDate.localeCompare(a.order.transactionDate));
}

export function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function orderItemNetAmount(item: Pick<MergedReceiptItem, "amount" | "discount">): number {
  return item.amount + item.discount;
}
