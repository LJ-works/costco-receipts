import { fetchBatchItemDetails, type ProductDetailMap } from "../../common/client";
import { loadAllProducts, saveProducts } from "../../common/db";
import { formatMoney } from "../../common/order";
import {
  isDiscounted,
  loadWatchlist,
  MAX_WATCHLIST,
  normalizeItemNumber,
  saveWatchlist,
} from "./pricing-warning";

export async function showPricingWarningUi(opts: {
  clientId: string;
  warehouseNumber: string;
}): Promise<void> {
  const products: ProductDetailMap = await loadAllProducts();
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

  const title = document.createElement("div");
  title.textContent = "Price Watch";
  title.style.cssText = "flex:1;font-size:18px;font-weight:bold;";

  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.cssText =
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
  topRow.append(title, closeButton);
  header.append(topRow, inputRow);
  overlay.append(header, content);
  document.body.appendChild(overlay);

  function renderList(): void {
    if (watchlist.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No items are being watched. Add one by its item number.";
      empty.style.cssText = "padding:24px 8px;color:#6b7280;text-align:center;";
      content.replaceChildren(empty);
      return;
    }

    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:10px;";
    for (const id of watchlist) list.appendChild(createRow(id));
    content.replaceChildren(list);
  }

  function createRow(id: string): HTMLElement {
    const product = products[id];
    const discounted = product !== undefined && isDiscounted(product);

    const card = document.createElement("div");
    card.style.cssText =
      "display:flex;align-items:flex-start;gap:8px;padding:12px;border-radius:8px;" +
      (discounted
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

    const price = document.createElement("div");
    price.style.cssText = "font-size:14px;color:#374151;line-height:1.5;";
    if (product?.price != null) {
      price.textContent = `Price ${formatMoney(product.price)}`;
      if (discounted && product.listPrice != null) {
        const now = document.createElement("span");
        now.textContent = ` Now ${formatMoney(product.listPrice)}`;
        now.style.cssText = "font-weight:bold;color:#005dab;";
        price.appendChild(now);
      }
    } else {
      price.textContent = "Price unavailable";
    }

    info.append(name, itemId, price);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.style.cssText =
      "padding:6px 10px;background:#f3f4f6;border:1px solid #d1d5db;" +
      "border-radius:6px;font-size:13px;cursor:pointer;";
    deleteButton.addEventListener("click", () => {
      watchlist = watchlist.filter((x) => x !== id);
      saveWatchlist(watchlist);
      renderList();
    });

    card.append(info, deleteButton);
    return card;
  }

  async function addItem(): Promise<void> {
    const id = normalizeItemNumber(input.value);
    if (!id) return;
    if (watchlist.includes(id)) {
      input.value = "";
      return;
    }
    if (watchlist.length >= MAX_WATCHLIST) {
      alert(`You can watch at most ${MAX_WATCHLIST} items.`);
      return;
    }

    if (products[id] === undefined) {
      addButton.disabled = true;
      try {
        const fetched = await fetchBatchItemDetails({
          itemNumbers: [id],
          clientId: opts.clientId,
          warehouseNumber: opts.warehouseNumber,
        });
        if (fetched[id] === undefined) {
          alert("Item not found.");
          return;
        }
        Object.assign(products, fetched);
        await saveProducts(fetched);
      } finally {
        addButton.disabled = false;
      }
    }

    watchlist = [...watchlist, id];
    saveWatchlist(watchlist);
    input.value = "";
    renderList();
  }

  closeButton.addEventListener("click", () => overlay.remove());
  addButton.addEventListener("click", addItem);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addItem();
  });

  renderList();
  input.focus();
}
