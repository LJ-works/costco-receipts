import type { ProductDetailMap } from "../../common/client";
import { loadAllOrders, loadAllProducts } from "../../common/db";
import { createOrderDetail, displayOrderItemName } from "../../common/order-detail-ui";
import { formatMoney } from "../../common/order";
import { addWatchlistItem, loadWatchlist, saveWatchlist } from "../pricing-warning/pricing-warning";
import {
  searchOrdersByProductText,
  splitHighlightSegments,
  type OrderSearchMatch,
} from "./order-search";

interface MatchedPreviewItem {
  name: string;
  amount: number;
}

function matchedPreviewItems(
  match: OrderSearchMatch,
  products: ProductDetailMap,
): MatchedPreviewItem[] {
  return match.matchedItemNumbers
    .map((itemNumber) => {
      const item = match.order.itemArray.find((candidate) => candidate.itemNumber === itemNumber);
      return item ? { name: displayOrderItemName(item, products), amount: item.amount } : null;
    })
    .filter((item): item is MatchedPreviewItem => item !== null)
    .slice(0, 3);
}

function appendHighlightedText(element: HTMLElement, text: string, query: string): void {
  for (const segment of splitHighlightSegments(text, query)) {
    if (!segment.highlighted) {
      element.appendChild(document.createTextNode(segment.text));
      continue;
    }

    const highlight = document.createElement("mark");
    highlight.textContent = segment.text;
    highlight.style.cssText = "background:#fef08a;color:inherit;padding:0 1px;";
    element.appendChild(highlight);
  }
}

export async function showOrderSearchUi(): Promise<void> {
  const [orders, products] = await Promise.all([loadAllOrders(), loadAllProducts()]);
  let watchlist = loadWatchlist();

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
  backButton.textContent = "Search Results";
  backButton.style.cssText =
    "display:none;padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const title = document.createElement("div");
  title.textContent = "Find Orders";
  title.style.cssText = "flex:1;font-size:18px;font-weight:bold;";

  const featureBackButton = document.createElement("button");
  featureBackButton.textContent = "Back";
  featureBackButton.style.cssText =
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

  topRow.append(backButton, title, featureBackButton);
  header.append(topRow, input);
  overlay.append(header, content);
  document.body.appendChild(overlay);

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
      preview.style.cssText = "font-size:13px;color:#6b7280;line-height:1.4;";
      for (const [index, matchedItem] of matchedPreviewItems(match, products).entries()) {
        if (index > 0) preview.appendChild(document.createTextNode(", "));
        appendHighlightedText(preview, matchedItem.name, query);
        preview.appendChild(document.createTextNode(` | ${formatMoney(matchedItem.amount)}`));
      }

      item.append(main, preview);
      item.addEventListener("click", () => renderOrderDetail(match));
      list.appendChild(item);
    }

    content.replaceChildren(list);
  }

  function renderOrderDetail(match: OrderSearchMatch): void {
    title.textContent = "Order Details";
    backButton.style.display = "inline-block";
    input.style.display = "none";

    content.replaceChildren(
      createOrderDetail(match.order, products, new Set(match.matchedItemNumbers), {
        isWatching: (itemNumber) => watchlist.includes(itemNumber),
        onWatchItem: (itemNumber) => {
          const result = addWatchlistItem(watchlist, itemNumber);
          if (result.status === "added") {
            watchlist = result.watchlist;
            saveWatchlist(watchlist);
          }
          return result.status;
        },
      }),
    );
  }

  backButton.addEventListener("click", renderResults);
  input.addEventListener("input", renderResults);

  renderResults();
  input.focus();

  await new Promise<void>((resolve) => {
    featureBackButton.addEventListener(
      "click",
      () => {
        overlay.remove();
        resolve();
      },
      { once: true },
    );
  });
}
