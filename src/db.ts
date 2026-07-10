import { createStore, entries, keys, set } from "idb-keyval";
import type { MergedReceipt, ProductDetail, ProductDetailMap } from "./client";

const ordersStore = createStore("costco-userjs:orders", "orders");
const productsStore = createStore("costco-userjs:products", "products");
const LAST_RETRIEVE_KEY = "costco-userjs:last-retrieve";

export async function saveOrders(orders: MergedReceipt[]): Promise<void> {
  await Promise.all(orders.map((order) => set(order.transactionBarcode, order, ordersStore)));
}

export async function loadAllOrders(): Promise<MergedReceipt[]> {
  const allEntries = await entries<string, MergedReceipt>(ordersStore);
  return allEntries.map(([, order]) => order);
}

export async function cachedProductNumbers(): Promise<Set<string>> {
  const productKeys = await keys<string>(productsStore);
  return new Set(productKeys);
}

export async function loadAllProducts(): Promise<ProductDetailMap> {
  const allEntries = await entries<string, ProductDetail>(productsStore);
  return Object.fromEntries(allEntries);
}

export async function saveProducts(map: ProductDetailMap): Promise<void> {
  await Promise.all(
    Object.entries(map).map(([itemNumber, detail]) => set(itemNumber, detail, productsStore)),
  );
}

export function loadLastRetrieve(storage: Pick<Storage, "getItem"> = localStorage): Date | null {
  const raw = storage.getItem(LAST_RETRIEVE_KEY);
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function saveLastRetrieve(
  date: Date,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(LAST_RETRIEVE_KEY, date.toISOString());
}
