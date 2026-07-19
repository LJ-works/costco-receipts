import { activeWatchedItemNumbers, buildWarehouseDealIndex } from "../../common/warehouse-deals";
import type { WarehouseDeal } from "../../common/warehouse-savings";

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

export function activeWatchlistItems(
  watchlist: readonly string[],
  deals: readonly WarehouseDeal[],
): string[] {
  return activeWatchedItemNumbers(watchlist, buildWarehouseDealIndex(deals));
}

export function countActiveWatchlistDeals(
  watchlist: readonly string[],
  deals: readonly WarehouseDeal[],
): number {
  return activeWatchlistItems(watchlist, deals).length;
}
