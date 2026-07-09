import {
  fetchBatchItemDetails,
  fetchReceiptsByDateRange,
  type CostcoAuth,
  type MergedReceipt,
} from "./client";
import {
  cachedProductNumbers,
  loadAllOrders,
  loadLastRetrieve,
  saveLastRetrieve,
  saveOrders,
  saveProducts,
} from "./db";

const INITIAL_SYNC_DAYS = 100;

/** 需要拉取的商品 = 未缓存的全部 ∪ 近 recentDays 天购买过的（无论是否已缓存，用于刷新价格）。 */
export function selectProductsToFetch(
  orders: Pick<MergedReceipt, "transactionDate" | "itemArray">[],
  cached: Set<string>,
  now: Date,
  recentDays = 30,
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
    // TODO: 改 3 年。现在 100 天是为少发请求。
    startDate.setDate(startDate.getDate() - INITIAL_SYNC_DAYS);
  }

  onProgress?.("订单", 0, 0);
  const { receipts } = await fetchReceiptsByDateRange({
    idToken,
    clientId,
    startDate,
    endDate: now,
    documentType: "warehouse",
  });
  onProgress?.("订单", receipts.length, receipts.length);

  const oldOrders = await loadAllOrders();
  const oldOrderBarcodes = new Set(oldOrders.map((order) => order.transactionBarcode));
  const newOrderCount = receipts.filter(
    (order) => !oldOrderBarcodes.has(order.transactionBarcode),
  ).length;

  await saveOrders(receipts);
  const allOrders = await loadAllOrders();
  const cached = await cachedProductNumbers();
  const productsToFetch = selectProductsToFetch(allOrders, cached, now);

  const productDetails = await fetchBatchItemDetails({
    itemNumbers: productsToFetch,
    clientId,
    warehouseNumber,
    onProgress: (done, total) => onProgress?.("商品", done, total),
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
