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
const INITIAL_SYNC_YEARS = 5;

/** Fetch uncached product metadata used for names and images; prices are not refreshed here. */
export function selectProductsToFetch(
  orders: Pick<MergedReceipt, "itemArray">[],
  cached: Set<string>,
): string[] {
  const selected = new Set<string>();
  for (const order of orders) {
    for (const item of order.itemArray) {
      if (!cached.has(item.itemNumber)) selected.add(item.itemNumber);
    }
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
  const productsToFetch = selectProductsToFetch(allOrders, cached);

  const productDetails = await fetchBatchItemDetails({
    itemNumbers: productsToFetch,
    clientId,
    warehouseNumber,
    onProgress: (done, total) => onProgress?.("Product metadata", done, total),
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
