import type { CurrentPricingContext, PricingResolution } from "../../common/current-pricing";
import { loadAllProducts } from "../../common/db";
import {
  addWatchlistItem,
  loadWatchlist,
  MAX_WATCHLIST,
  normalizeItemNumber,
  saveWatchlist,
} from "./pricing-warning";

export async function showPricingWarningUi(options: {
  pricing: CurrentPricingContext;
}): Promise<void> {
  const products = await loadAllProducts();
  let watchlist = loadWatchlist();
  await options.pricing.ensureFallback(watchlist);

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
  const title = document.createElement("div");
  title.textContent = "Price Watch";
  title.style.cssText = "flex:1;font-size:18px;font-weight:bold;";
  const backButton = document.createElement("button");
  backButton.textContent = "Back";
  backButton.style.cssText =
    "padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
    "border-radius:6px;font-size:14px;cursor:pointer;";

  const inputRow = document.createElement("div");
  inputRow.style.cssText = "display:flex;gap:8px;";
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.placeholder = "Enter an item number";
  input.autocomplete = "off";
  input.style.cssText =
    "box-sizing:border-box;flex:1;padding:11px 12px;border:1px solid #cbd5e1;" +
    "border-radius:8px;font-size:16px;";
  const addButton = document.createElement("button");
  addButton.textContent = "Add";
  addButton.style.cssText =
    "padding:0 16px;background:#005dab;color:#fff;border:none;border-radius:8px;" +
    "font-size:15px;cursor:pointer;";
  const content = document.createElement("div");
  content.style.cssText = "flex:1;overflow:auto;padding:14px;";

  inputRow.append(input, addButton);
  topRow.append(title, backButton);
  header.append(topRow, inputRow);
  overlay.append(header, content);
  document.body.appendChild(overlay);

  function renderList(): void {
    if (!options.pricing.warehouseSavingsAvailable) {
      const warning = document.createElement("div");
      warning.textContent =
        "Warehouse Savings could not be loaded. Product API fallback results are shown when available.";
      warning.style.cssText = "padding:12px;margin-bottom:12px;background:#fffbeb;color:#92400e;";
      content.replaceChildren(warning, createList());
      return;
    }
    content.replaceChildren(createList());
  }

  function createList(): HTMLElement {
    if (watchlist.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No items are being watched. Add one by its item number.";
      empty.style.cssText = "padding:24px 8px;color:#6b7280;text-align:center;";
      return empty;
    }
    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:10px;";
    for (const id of watchlist) list.appendChild(createRow(id));
    return list;
  }

  function createRow(id: string): HTMLElement {
    const resolution = options.pricing.resolve(id);
    const fallbackProduct =
      resolution.source === "product_api_fallback" ? resolution.product : null;
    const product = products[id] ?? fallbackProduct;
    const active = resolution.source !== "unavailable";
    const card = document.createElement("div");
    card.style.cssText =
      "display:flex;align-items:flex-start;gap:8px;padding:12px;border-radius:8px;" +
      (active
        ? "background:#fef9c3;border:1px solid #f59e0b;"
        : "background:#fff;border:1px solid #d1d5db;");
    const info = document.createElement("div");
    info.style.cssText = "flex:1;";
    const name = document.createElement("div");
    name.textContent = product?.itemActualName || `Item #${id}`;
    name.style.cssText = "font-size:15px;font-weight:bold;margin-bottom:4px;";
    const itemId = document.createElement("div");
    itemId.textContent = `Item #: ${id}`;
    itemId.style.cssText = "font-size:12px;color:#6b7280;margin-bottom:7px;";
    const offer = document.createElement("div");
    offer.textContent = formatResolution(resolution);
    offer.style.cssText = active
      ? "font-size:14px;font-weight:bold;color:#005dab;line-height:1.5;"
      : "font-size:14px;color:#6b7280;line-height:1.5;";
    info.append(name, itemId, offer);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.style.cssText =
      "padding:6px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
      "border-radius:6px;font-size:13px;cursor:pointer;";
    deleteButton.addEventListener("click", () => {
      watchlist = watchlist.filter((item) => item !== id);
      saveWatchlist(watchlist);
      renderList();
    });
    card.append(info, deleteButton);
    return card;
  }

  async function addItem(): Promise<void> {
    const id = normalizeItemNumber(input.value);
    if (!id) return;
    const result = addWatchlistItem(watchlist, id);
    if (result.status === "already_watching") {
      input.value = "";
      return;
    }
    if (result.status === "limit_reached") {
      alert(`You can watch at most ${MAX_WATCHLIST} items.`);
      return;
    }
    watchlist = result.watchlist;
    saveWatchlist(watchlist);
    input.value = "";
    addButton.disabled = true;
    try {
      await options.pricing.ensureFallback([id]);
    } finally {
      addButton.disabled = false;
    }
    renderList();
  }

  addButton.addEventListener("click", addItem);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addItem();
  });
  renderList();
  input.focus();

  await new Promise<void>((resolve) => {
    backButton.addEventListener(
      "click",
      () => {
        overlay.remove();
        resolve();
      },
      { once: true },
    );
  });
}

function formatResolution(resolution: PricingResolution): string {
  if (resolution.source === "warehouse_savings") {
    return resolution.deals.map((deal) => deal.offer.raw.displayText || deal.title).join(" | ");
  }
  if (resolution.source === "product_api_fallback") {
    const { price, listPrice } = resolution.product;
    const saving = price !== null && listPrice !== null ? price - listPrice : null;
    return (
      `Product API fallback: $${listPrice?.toFixed(2)} (was $${price?.toFixed(2)})` +
      (saving === null ? "" : ` · Save $${saving.toFixed(2)}`)
    );
  }
  return "No current deal found";
}
