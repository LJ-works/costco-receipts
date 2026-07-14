import type { ProductDetail, ProductDetailMap } from "../../common/client";

const WATCHLIST_KEY = "costco-userjs:price-watchlist";

/** Maximum number of items a watchlist may hold. */
export const MAX_WATCHLIST = 50;

export function loadWatchlist(storage: Pick<Storage, "getItem"> = localStorage): string[] {
  const raw = storage.getItem(WATCHLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    // Ignore corrupted stored data.
  }
  return [];
}

export function saveWatchlist(
  ids: string[],
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(WATCHLIST_KEY, JSON.stringify(ids));
}

/** Trim and accept only a plain digit string; otherwise null. */
export function normalizeItemNumber(input: string): string | null {
  const trimmed = input.trim();
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

/** A product is discounted when its current listPrice is below its regular price. */
export function isDiscounted(product: Pick<ProductDetail, "price" | "listPrice">): boolean {
  return product.listPrice !== null && product.price !== null && product.listPrice < product.price;
}

export function countDiscounted(watchlist: string[], products: ProductDetailMap): number {
  return watchlist.filter((id) => {
    const product = products[id];
    return product !== undefined && isDiscounted(product);
  }).length;
}
