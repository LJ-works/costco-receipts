import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "../../common/client";
import { orderItemDescriptions } from "../../common/order";

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

function searchableTexts(item: MergedReceiptItem, products: ProductDetailMap): string[] {
  return nonEmptyTexts([products[item.itemNumber]?.itemActualName, ...orderItemDescriptions(item)]);
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
