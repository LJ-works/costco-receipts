import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "../../common/client";
import { orderItemDescriptions } from "../../common/order";

export interface OrderSearchMatch {
  order: MergedReceipt;
  matchedItemNumbers: string[];
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function nonEmptyTexts(values: (string | null | undefined)[]): string[] {
  return values.map((value) => value?.trim() ?? "").filter((value) => value.length > 0);
}

function queryKeywords(query: string): string[] {
  const normalizedQuery = normalizeText(query);
  return normalizedQuery ? normalizedQuery.split(/\s+/) : [];
}

/** Splits text into plain and matched segments for case-insensitive keyword highlighting. */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const keywords = queryKeywords(query);
  if (keywords.length === 0) return [{ text, highlighted: false }];

  const normalizedText = text.toLowerCase();
  const ranges: [number, number][] = [];

  for (const keyword of keywords) {
    let start = 0;
    while (start < normalizedText.length) {
      const index = normalizedText.indexOf(keyword, start);
      if (index === -1) break;
      ranges.push([index, index + keyword.length]);
      start = index + keyword.length;
    }
  }

  if (ranges.length === 0) return [{ text, highlighted: false }];

  ranges.sort(([startA], [startB]) => startA - startB);
  const mergedRanges: [number, number][] = [];
  for (const [start, end] of ranges) {
    const previous = mergedRanges.at(-1);
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      mergedRanges.push([start, end]);
    }
  }

  const segments: HighlightSegment[] = [];
  let position = 0;
  for (const [start, end] of mergedRanges) {
    if (position < start) segments.push({ text: text.slice(position, start), highlighted: false });
    segments.push({ text: text.slice(start, end), highlighted: true });
    position = end;
  }
  if (position < text.length) segments.push({ text: text.slice(position), highlighted: false });

  return segments;
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
