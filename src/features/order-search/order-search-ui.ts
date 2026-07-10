import type { MergedReceipt, ProductDetailMap } from "../../common/client";
import { loadAllOrders, loadAllProducts } from "../../common/db";
import { createOrderDetail, displayOrderItemName } from "../../common/order-detail-ui";
import { formatMoney } from "../../common/order";
import { searchOrdersByProductText, type OrderSearchMatch } from "./order-search";

function matchedPreview(match: OrderSearchMatch, products: ProductDetailMap): string {
  return match.matchedItemNumbers
    .map((itemNumber) => {
      const item = match.order.itemArray.find((candidate) => candidate.itemNumber === itemNumber);
      return item ? `${displayOrderItemName(item, products)} | ${formatMoney(item.amount)}` : null;
    })
    .filter((preview): preview is string => preview !== null)
    .slice(0, 3)
    .join(", ");
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
  backButton.textContent = "Back";
  backButton.style.cssText =
    "display:none;padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const title = document.createElement("div");
  title.textContent = "Find Orders";
  title.style.cssText = "flex:1;font-size:18px;font-weight:bold;";

  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.cssText =
    "padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Enter a product name or item number";
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
    title.textContent = "Find Orders";
    backButton.style.display = "none";
    input.style.display = "block";
  }

  function renderResults(): void {
    showSearchMode();

    if (orders.length === 0) {
      showMessage("No orders are available to search.");
      return;
    }

    const query = input.value;
    if (!query.trim()) {
      showMessage("Enter a product name or item number.");
      return;
    }

    const matches = searchOrdersByProductText(orders, products, query);
    if (matches.length === 0) {
      showMessage("No matching orders found.");
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
      main.textContent = match.order.transactionDate;
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
    title.textContent = "Order Details";
    backButton.style.display = "inline-block";
    input.style.display = "none";

    content.replaceChildren(createOrderDetail(order, products));
  }

  closeButton.addEventListener("click", close);
  backButton.addEventListener("click", renderResults);
  input.addEventListener("input", renderResults);

  renderResults();
  input.focus();
}
