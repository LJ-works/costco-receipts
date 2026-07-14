import { fetchReceiptsByDateRange } from "./common/client";
import { loadAllProducts } from "./common/db";
import { showProgress } from "./common/progress";
import {
  extractWarehouses,
  loadSelectedWarehouse,
  saveSelectedWarehouse,
  type WarehouseVisit,
} from "./common/warehouses";
import { showFeaturePicker } from "./feature-picker";
import { showOrderSearchUi } from "./features/order-search/order-search-ui";
import { showPriceAdjustmentUi } from "./features/price-adjustment/price-adjustment-ui";
import { countDiscounted, loadWatchlist } from "./features/pricing-warning/pricing-warning";
import { showPricingWarningUi } from "./features/pricing-warning/pricing-warning-ui";
import { syncOrdersAndProducts } from "./sync";

const DAYS_BACK = 100;

function showWarehousePicker(warehouses: WarehouseVisit[]): Promise<WarehouseVisit> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;" +
      "display:flex;align-items:center;justify-content:center;padding:16px;";

    const box = document.createElement("div");
    box.style.cssText =
      "background:#fff;border-radius:8px;max-width:320px;width:100%;" +
      "max-height:80vh;overflow-y:auto;padding:16px;";

    const title = document.createElement("div");
    title.textContent = "Select Your Preferred Warehouse";
    title.style.cssText = "font-size:16px;font-weight:bold;margin-bottom:12px;";
    box.appendChild(title);

    for (const warehouse of warehouses) {
      const item = document.createElement("button");
      item.textContent = `${warehouse.name} (#${warehouse.id})`;
      item.style.cssText =
        "display:block;width:100%;padding:10px;margin-bottom:8px;font-size:14px;" +
        "background:#f2f2f2;border:none;border-radius:4px;cursor:pointer;text-align:left;";
      item.addEventListener("click", () => {
        saveSelectedWarehouse(warehouse);
        document.body.removeChild(overlay);
        resolve(warehouse);
      });
      box.appendChild(item);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

async function discoverWarehouse(
  idToken: string,
  clientId: string,
): Promise<WarehouseVisit | null> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  const { receipts } = await fetchReceiptsByDateRange({
    idToken,
    clientId,
    startDate,
    endDate,
    documentType: "warehouse",
  });

  const warehouses = extractWarehouses(receipts);
  if (warehouses.length === 0) return null;

  if (warehouses.length === 1) {
    saveSelectedWarehouse(warehouses[0]);
    return warehouses[0];
  }

  return showWarehousePicker(warehouses);
}

async function run(): Promise<void> {
  const idToken = localStorage.idToken;
  const clientId = localStorage.clientID;

  if (!idToken || !clientId) {
    alert("Please sign in to costco.com, open Account > Orders & Purchases, and try again.");
    return;
  }

  try {
    const selected = loadSelectedWarehouse() ?? (await discoverWarehouse(idToken, clientId));
    const warehouseNumber = String(selected?.id ?? 847);
    const ui = showProgress();

    try {
      await syncOrdersAndProducts({
        idToken,
        clientId,
        warehouseNumber,
        onProgress: ui.update,
      });
      ui.remove();
    } catch (err) {
      console.error("Synchronization failed", err);
      ui.remove();
      alert(
        "Synchronization failed. Please sign in to costco.com, open Account > Orders & Purchases, and try again.",
      );
      return;
    }

    const discountedCount = countDiscounted(loadWatchlist(), await loadAllProducts());
    const feature = await showFeaturePicker({ "pricing-warning": discountedCount });
    if (feature === "find-order") await showOrderSearchUi();
    if (feature === "price-adjustment") await showPriceAdjustmentUi();
    if (feature === "pricing-warning") await showPricingWarningUi({ clientId, warehouseNumber });
  } catch (err) {
    console.error("Failed to retrieve orders or load the cache", err);
    alert(
      "The operation failed. Please sign in to costco.com, open Account > Orders & Purchases, and try again.",
    );
  }
}

// Use a plain DOM button instead of GM_registerMenuCommand or @run-at context-menu because
// quoid/userscripts on iOS Safari supports neither; the button works across extensions.
function addTriggerButton(): void {
  const button = document.createElement("button");
  button.textContent = "Start";
  button.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;padding:8px 14px;" +
    "background:#005dab;color:#fff;border:none;border-radius:4px;cursor:pointer;" +
    "font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.3);";
  button.addEventListener("click", run);
  document.body.appendChild(button);
}

addTriggerButton();
