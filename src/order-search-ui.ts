import type { MergedReceipt, MergedReceiptItem, ProductDetailMap } from "./client";
import { loadAllOrders, loadAllProducts } from "./db";
import {
  fallbackOrderItemName,
  formatMoney,
  orderItemNetAmount,
  searchOrdersByProductText,
  type OrderSearchMatch,
} from "./order-search";

function productName(
  item: Pick<MergedReceiptItem, "itemNumber">,
  products: ProductDetailMap,
): string | null {
  const name = products[item.itemNumber]?.itemActualName?.trim();
  return name ? name : null;
}

function displayItemName(item: MergedReceiptItem, products: ProductDetailMap): string {
  return productName(item, products) ?? fallbackOrderItemName(item);
}

function itemAmountText(item: MergedReceiptItem): string {
  if (item.discount === 0) return formatMoney(item.amount);

  return `原价 ${formatMoney(item.amount)}，优惠 ${formatMoney(Math.abs(item.discount))}，折后 ${formatMoney(orderItemNetAmount(item))}`;
}

function itemQuantityText(item: MergedReceiptItem): string | null {
  if (item.unit == null || item.unit === 1) return null;
  return `数量 ${item.unit}`;
}

function matchedPreview(match: OrderSearchMatch, products: ProductDetailMap): string {
  const names = match.matchedItemNumbers.map((itemNumber) => {
    const item = match.order.itemArray.find((candidate) => candidate.itemNumber === itemNumber);
    return item ? displayItemName(item, products) : products[itemNumber]?.itemActualName;
  });
  return names
    .filter((name): name is string => Boolean(name))
    .slice(0, 3)
    .join("、");
}

export async function showOrderSearchUi(): Promise<void> {
  const [orders, products] = await Promise.all([loadAllOrders(), loadAllProducts()]);

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:#fff;z-index:2147483647;color:#111;" +
    "display:flex;flex-direction:column;font-size:14px;";

  const header = document.createElement("div");
  header.style.cssText =
    "padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#fff;" +
    "position:sticky;top:0;z-index:1;";

  const topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;";

  const backButton = document.createElement("button");
  backButton.textContent = "返回";
  backButton.style.cssText =
    "display:none;padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const title = document.createElement("div");
  title.textContent = "查找订单";
  title.style.cssText = "flex:1;font-size:18px;font-weight:bold;";

  const closeButton = document.createElement("button");
  closeButton.textContent = "关闭";
  closeButton.style.cssText =
    "padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "输入商品名";
  input.autocomplete = "off";
  input.style.cssText =
    "box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #cbd5e1;" +
    "border-radius:8px;font-size:16px;";

  const content = document.createElement("div");
  content.style.cssText = "flex:1;overflow:auto;padding:14px;";

  topRow.append(backButton, title, closeButton);
  header.append(topRow, input);
  overlay.append(header, content);
  document.body.appendChild(overlay);

  function close(): void {
    overlay.remove();
  }

  function showMessage(message: string): void {
    const empty = document.createElement("div");
    empty.textContent = message;
    empty.style.cssText = "padding:24px 8px;color:#6b7280;text-align:center;";
    content.replaceChildren(empty);
  }

  function showSearchMode(): void {
    title.textContent = "查找订单";
    backButton.style.display = "none";
    input.style.display = "block";
  }

  function renderResults(): void {
    showSearchMode();

    if (orders.length === 0) {
      showMessage("没有可搜索的订单");
      return;
    }

    const query = input.value;
    if (!query.trim()) {
      showMessage("请输入商品名");
      return;
    }

    const matches = searchOrdersByProductText(orders, products, query);
    if (matches.length === 0) {
      showMessage("没有找到匹配订单");
      return;
    }

    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:10px;";

    for (const match of matches) {
      const item = document.createElement("button");
      item.style.cssText =
        "display:block;width:100%;padding:12px;background:#fff;border:1px solid #d1d5db;" +
        "border-radius:8px;text-align:left;cursor:pointer;color:#111;";

      const main = document.createElement("div");
      main.textContent = `${match.order.transactionDate} · ${formatMoney(match.order.total)}`;
      main.style.cssText = "font-size:16px;font-weight:bold;margin-bottom:4px;";

      const preview = document.createElement("div");
      preview.textContent = matchedPreview(match, products);
      preview.style.cssText = "font-size:13px;color:#6b7280;line-height:1.4;";

      item.append(main, preview);
      item.addEventListener("click", () => renderOrderDetail(match.order));
      list.appendChild(item);
    }

    content.replaceChildren(list);
  }

  function renderOrderDetail(order: MergedReceipt): void {
    title.textContent = "订单详情";
    backButton.style.display = "inline-block";
    input.style.display = "none";

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
      row.style.cssText =
        "padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;";

      const name = document.createElement("div");
      name.textContent = displayItemName(orderItem, products);
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

    content.replaceChildren(container);
  }

  closeButton.addEventListener("click", close);
  backButton.addEventListener("click", renderResults);
  input.addEventListener("input", renderResults);

  renderResults();
  input.focus();
}
