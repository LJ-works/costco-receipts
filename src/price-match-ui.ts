import { loadAllOrders, loadAllProducts } from "./db";
import { createOrderDetail, displayOrderItemName } from "./order-detail-ui";
import { formatMoney } from "./order-search";
import { PRICE_MATCH_DAYS, findPriceMatches, type PriceMatchOrder } from "./price-match";

export async function showPriceMatchUi(): Promise<void> {
  const [orders, products] = await Promise.all([loadAllOrders(), loadAllProducts()]);
  const matches = findPriceMatches(orders, products, new Date(), PRICE_MATCH_DAYS);

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:#fff;z-index:2147483647;color:#111;" +
    "display:flex;flex-direction:column;font-size:14px;";

  const header = document.createElement("div");
  header.style.cssText =
    "padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#fff;" +
    "position:sticky;top:0;z-index:1;";

  const topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;align-items:center;gap:8px;";

  const backButton = document.createElement("button");
  backButton.textContent = "返回";
  backButton.style.cssText =
    "display:none;padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const title = document.createElement("div");
  title.textContent = "30 天价格匹配";
  title.style.cssText = "flex:1;font-size:18px;font-weight:bold;";

  const closeButton = document.createElement("button");
  closeButton.textContent = "关闭";
  closeButton.style.cssText =
    "padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const content = document.createElement("div");
  content.style.cssText = "flex:1;overflow:auto;padding:14px;";

  topRow.append(backButton, title, closeButton);
  header.appendChild(topRow);
  overlay.append(header, content);
  document.body.appendChild(overlay);

  function renderResults(): void {
    title.textContent = "30 天价格匹配";
    backButton.style.display = "none";

    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = `最近 ${PRICE_MATCH_DAYS} 天没有符合条件的降价商品`;
      empty.style.cssText = "padding:24px 8px;color:#6b7280;text-align:center;";
      content.replaceChildren(empty);
      return;
    }

    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:16px;";

    for (const match of matches) {
      list.appendChild(createOrderMatchGroup(match));
    }

    content.replaceChildren(list);
  }

  function createOrderMatchGroup(match: PriceMatchOrder): HTMLElement {
    const section = document.createElement("section");
    section.style.cssText = "display:flex;flex-direction:column;gap:8px;";

    const date = document.createElement("div");
    date.textContent = match.order.transactionDate;
    date.style.cssText = "font-size:16px;font-weight:bold;padding:2px 2px;";
    section.appendChild(date);

    for (const matchedItem of match.items) {
      const button = document.createElement("button");
      button.style.cssText =
        "display:block;width:100%;padding:12px;background:#fff;border:1px solid #d1d5db;" +
        "border-radius:8px;text-align:left;cursor:pointer;color:#111;";

      const name = document.createElement("div");
      name.textContent = displayOrderItemName(matchedItem.item, products);
      name.style.cssText = "font-size:15px;font-weight:bold;margin-bottom:4px;";

      const id = document.createElement("div");
      id.textContent = `商品号：${matchedItem.item.itemNumber}`;
      id.style.cssText = "font-size:12px;color:#6b7280;margin-bottom:7px;";

      const orderPrice = document.createElement("div");
      orderPrice.textContent = `订单原始金额 ${formatMoney(matchedItem.item.amount)} · 订单折扣 ${formatMoney(matchedItem.item.discount)}`;
      orderPrice.style.cssText = "font-size:13px;color:#374151;line-height:1.5;";

      const priceMatch = document.createElement("div");
      priceMatch.textContent = `折后旧价格 ${formatMoney(matchedItem.oldPrice)} · 新价格 ${formatMoney(matchedItem.newPrice)}`;
      priceMatch.style.cssText = "font-size:14px;font-weight:bold;color:#005dab;line-height:1.5;";

      button.append(name, id, orderPrice, priceMatch);
      if (matchedItem.quantity > 1) {
        const quantity = document.createElement("div");
        quantity.textContent = `数量：${matchedItem.quantity}`;
        quantity.style.cssText = "font-size:13px;color:#374151;margin-top:4px;";
        button.appendChild(quantity);
      }

      button.addEventListener("click", () => renderOrderDetail(match));
      section.appendChild(button);
    }

    return section;
  }

  function renderOrderDetail(match: PriceMatchOrder): void {
    title.textContent = "订单详情";
    backButton.style.display = "inline-block";
    content.replaceChildren(createOrderDetail(match.order, products));
  }

  closeButton.addEventListener("click", () => overlay.remove());
  backButton.addEventListener("click", renderResults);

  renderResults();
}
