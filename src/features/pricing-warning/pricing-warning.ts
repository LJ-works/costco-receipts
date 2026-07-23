import type { PricingLookup } from "../../common/current-pricing";

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

export type AddWatchlistStatus = "added" | "already_watching" | "limit_reached";

export interface AddWatchlistResult {
  status: AddWatchlistStatus;
  watchlist: string[];
}

export function addWatchlistItem(
  watchlist: readonly string[],
  itemNumber: string,
): AddWatchlistResult {
  if (watchlist.includes(itemNumber)) {
    return { status: "already_watching", watchlist: [...watchlist] };
  }
  if (watchlist.length >= MAX_WATCHLIST) {
    return { status: "limit_reached", watchlist: [...watchlist] };
  }
  return { status: "added", watchlist: [...watchlist, itemNumber] };
}

/** Trim and accept only a plain digit string; otherwise null. */
export function normalizeItemNumber(input: string): string | null {
  const trimmed = input.trim();
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

export function activeWatchlistItems(
  watchlist: readonly string[],
  pricing: PricingLookup,
): string[] {
  return [...new Set(watchlist)].filter((itemNumber) => {
    const resolution = pricing.resolve(itemNumber);
    return (
      resolution.source === "warehouse_savings" || resolution.source === "product_api_fallback"
    );
  });
}

export function countActiveWatchlistDeals(
  watchlist: readonly string[],
  pricing: PricingLookup,
): number {
  return activeWatchlistItems(watchlist, pricing).length;
}
