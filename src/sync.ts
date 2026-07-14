import {
  fetchBatchItemDetails,
  fetchReceiptsByDateRange,
  type CostcoAuth,
  type MergedReceipt,
} from "./common/client";
import {
  cachedProductNumbers,
  loadAllOrders,
  loadLastRetrieve,
  saveLastRetrieve,
  saveOrders,
  saveProducts,
} from "./common/db";
import { loadWatchlist } from "./features/pricing-warning/pricing-warning";

const INITIAL_SYNC_YEARS = 3;

/** Products to fetch = all uncached products plus recently purchased products whose prices need refreshing. */
export function selectProductsToFetch(
  orders: Pick<MergedReceipt, "transactionDate" | "itemArray">[],
  cached: Set<string>,
  now: Date,
  recentDays = 30,
  watchlist: string[] = [],
): string[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - recentDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const all = new Set<string>();
  const recent = new Set<string>();

  for (const order of orders) {
    const isRecent = order.transactionDate >= cutoffDate;
    for (const item of order.itemArray) {
      all.add(item.itemNumber);
      if (isRecent) recent.add(item.itemNumber);
    }
  }

  const selected = new Set<string>(recent);
  for (const itemNumber of all) {
    if (!cached.has(itemNumber)) selected.add(itemNumber);
  }
  // Always refresh watched items so the badge and prices stay current.
  for (const itemNumber of watchlist) selected.add(itemNumber);
  return [...selected];
}

export interface SyncResult {
  newOrderCount: number;
  totalOrderCount: number;
  uniqueProductCount: number;
  fetchedProductCount: number;
}

export async function syncOrdersAndProducts({
  idToken,
  clientId,
  warehouseNumber,
  onProgress,
}: CostcoAuth & {
  warehouseNumber: string;
  onProgress?: (phase: string, done: number, total: number) => void;
}): Promise<SyncResult> {
  const now = new Date();
  const lastRetrieve = loadLastRetrieve();
  const startDate = lastRetrieve ?? new Date(now);
  if (!lastRetrieve) {
    startDate.setFullYear(startDate.getFullYear() - INITIAL_SYNC_YEARS);
  }

  onProgress?.("Orders", 0, 0);
  const { receipts } = await fetchReceiptsByDateRange({
    idToken,
    clientId,
    startDate,
    endDate: now,
    documentType: "warehouse",
  });
  onProgress?.("Orders", receipts.length, receipts.length);

  const oldOrders = await loadAllOrders();
  const oldOrderBarcodes = new Set(oldOrders.map((order) => order.transactionBarcode));
  const newOrderCount = receipts.filter(
    (order) => !oldOrderBarcodes.has(order.transactionBarcode),
  ).length;

  await saveOrders(receipts);
  const allOrders = await loadAllOrders();
  const cached = await cachedProductNumbers();
  const productsToFetch = selectProductsToFetch(allOrders, cached, now, 30, loadWatchlist());

  const productDetails = await fetchBatchItemDetails({
    itemNumbers: productsToFetch,
    clientId,
    warehouseNumber,
    onProgress: (done, total) => onProgress?.("Products", done, total),
  });
  await saveProducts(productDetails);
  saveLastRetrieve(now);

  const uniqueProducts = new Set<string>();
  for (const order of allOrders) {
    for (const item of order.itemArray) uniqueProducts.add(item.itemNumber);
  }

  return {
    newOrderCount,
    totalOrderCount: allOrders.length,
    uniqueProductCount: uniqueProducts.size,
    fetchedProductCount: productsToFetch.length,
  };
}
