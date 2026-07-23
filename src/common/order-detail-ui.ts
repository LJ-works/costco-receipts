import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "./client";
import { fallbackOrderItemName, formatMoney, orderItemNetAmount } from "./order";

export function displayOrderItemName(item: MergedReceiptItem, products: ProductDetailMap): string {
  const productName = products[item.itemNumber]?.itemActualName?.trim();
  return productName || fallbackOrderItemName(item);
}

function itemAmountText(item: MergedReceiptItem): string {
  if (item.discount === 0) return formatMoney(item.amount);

  return `Original ${formatMoney(item.amount)}, discount ${formatMoney(Math.abs(item.discount))}, paid ${formatMoney(orderItemNetAmount(item))}`;
}

function itemQuantityText(item: MergedReceiptItem): string | null {
  if (item.unit == null || item.unit === 1) return null;
  return `Quantity: ${item.unit}`;
}

export type WatchItemActionResult = "added" | "already_watching" | "limit_reached";

export interface OrderDetailOptions {
  isWatching?: (itemNumber: string) => boolean;
  onWatchItem?: (itemNumber: string) => WatchItemActionResult;
}

export function createOrderDetail(
  order: MergedReceipt,
  products: ProductDetailMap,
  highlightedItemNumbers: ReadonlySet<string> = new Set(),
  options: OrderDetailOptions = {},
): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;gap:12px;";

  const summary = document.createElement("div");
  summary.style.cssText =
    "padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;";

  const summaryTitle = document.createElement("div");
  summaryTitle.textContent = `${order.transactionDate} | ${formatMoney(order.total)}`;
  summaryTitle.style.cssText = "font-size:17px;font-weight:bold;margin-bottom:4px;";

  const warehouse = document.createElement("div");
  warehouse.textContent = order.warehouseName ? `Warehouse: ${order.warehouseName}` : "";
  warehouse.style.cssText = "font-size:13px;color:#6b7280;";

  summary.append(summaryTitle, warehouse);
  container.appendChild(summary);

  const watchButtons = new Map<string, HTMLButtonElement[]>();

  function setWatching(itemNumber: string): void {
    for (const button of watchButtons.get(itemNumber) ?? []) {
      button.textContent = "Watching";
      button.disabled = true;
      button.style.background = "#e5e7eb";
      button.style.color = "#4b5563";
      button.style.cursor = "default";
    }
  }

  for (const orderItem of order.itemArray) {
    const row = document.createElement("div");
    row.style.cssText = highlightedItemNumbers.has(orderItem.itemNumber)
      ? "padding:12px;border:1px solid #facc15;border-radius:8px;background:#fef9c3;"
      : "padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;";

    const name = document.createElement("div");
    name.textContent = displayOrderItemName(orderItem, products);
    name.style.cssText = "font-size:15px;font-weight:bold;margin-bottom:4px;";

    const productId = document.createElement("div");
    productId.textContent = `Item #: ${orderItem.itemNumber}`;
    productId.style.cssText = "font-size:12px;color:#6b7280;margin-bottom:6px;";

    const metaParts = [itemQuantityText(orderItem), itemAmountText(orderItem)].filter(
      (part): part is string => Boolean(part),
    );
    const meta = document.createElement("div");
    meta.textContent = metaParts.join(" | ");
    meta.style.cssText = "font-size:13px;color:#374151;line-height:1.4;";

    row.append(name, productId, meta);

    if (options.onWatchItem && /^\d+$/.test(orderItem.itemNumber)) {
      const watchButton = document.createElement("button");
      watchButton.type = "button";
      watchButton.textContent = "Add to Price Watch";
      watchButton.style.cssText =
        "margin-top:10px;padding:7px 10px;background:#005dab;color:#fff;border:none;" +
        "border-radius:6px;font-size:13px;cursor:pointer;";
      const buttons = watchButtons.get(orderItem.itemNumber) ?? [];
      buttons.push(watchButton);
      watchButtons.set(orderItem.itemNumber, buttons);

      if (options.isWatching?.(orderItem.itemNumber)) {
        setWatching(orderItem.itemNumber);
      } else {
        watchButton.addEventListener("click", () => {
          const result = options.onWatchItem?.(orderItem.itemNumber);
          if (result === "added" || result === "already_watching") {
            setWatching(orderItem.itemNumber);
          } else if (result === "limit_reached") {
            alert("You can watch at most 50 items.");
          }
        });
      }
      row.appendChild(watchButton);
    }

    container.appendChild(row);
  }

  return container;
}
