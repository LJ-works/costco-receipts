import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "./client";
import { fallbackOrderItemName, formatMoney, orderItemNetAmount } from "./order-search";

export function displayOrderItemName(item: MergedReceiptItem, products: ProductDetailMap): string {
  const productName = products[item.itemNumber]?.itemActualName?.trim();
  return productName || fallbackOrderItemName(item);
}

function itemAmountText(item: MergedReceiptItem): string {
  if (item.discount === 0) return formatMoney(item.amount);

  return `原价 ${formatMoney(item.amount)}，优惠 ${formatMoney(Math.abs(item.discount))}，折后 ${formatMoney(orderItemNetAmount(item))}`;
}

function itemQuantityText(item: MergedReceiptItem): string | null {
  if (item.unit == null || item.unit === 1) return null;
  return `数量 ${item.unit}`;
}

export function createOrderDetail(order: MergedReceipt, products: ProductDetailMap): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;gap:12px;";

  const summary = document.createElement("div");
  summary.style.cssText =
    "padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;";

  const summaryTitle = document.createElement("div");
  summaryTitle.textContent = `${order.transactionDate} · ${formatMoney(order.total)}`;
  summaryTitle.style.cssText = "font-size:17px;font-weight:bold;margin-bottom:4px;";

  const warehouse = document.createElement("div");
  warehouse.textContent = order.warehouseName ? `门店：${order.warehouseName}` : "";
  warehouse.style.cssText = "font-size:13px;color:#6b7280;";

  summary.append(summaryTitle, warehouse);
  container.appendChild(summary);

  for (const orderItem of order.itemArray) {
    const row = document.createElement("div");
    row.style.cssText = "padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;";

    const name = document.createElement("div");
    name.textContent = displayOrderItemName(orderItem, products);
    name.style.cssText = "font-size:15px;font-weight:bold;margin-bottom:4px;";

    const productId = document.createElement("div");
    productId.textContent = `商品号：${orderItem.itemNumber}`;
    productId.style.cssText = "font-size:12px;color:#6b7280;margin-bottom:6px;";

    const metaParts = [itemQuantityText(orderItem), itemAmountText(orderItem)].filter(
      (part): part is string => Boolean(part),
    );
    const meta = document.createElement("div");
    meta.textContent = metaParts.join(" · ");
    meta.style.cssText = "font-size:13px;color:#374151;line-height:1.4;";

    row.append(name, productId, meta);
    container.appendChild(row);
  }

  return container;
}
