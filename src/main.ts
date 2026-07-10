import { fetchReceiptsByDateRange } from "./client";
import { showProgress } from "./progress";
import { syncOrdersAndProducts, type SyncResult } from "./sync";
import {
  extractWarehouses,
  loadSelectedWarehouse,
  saveSelectedWarehouse,
  type WarehouseVisit,
} from "./warehouses";

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
    title.textContent = "选择常去的门店";
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

function formatSummary(result: SyncResult): string {
  return `同步完成：本次新增订单 ${result.newOrderCount} 张（累计 ${result.totalOrderCount}）、去重商品 ${result.uniqueProductCount} 个、本次拉取/刷新详情 ${result.fetchedProductCount} 个`;
}

async function run(): Promise<void> {
  const idToken = localStorage.idToken;
  const clientId = localStorage.clientID;

  if (!idToken || !clientId) {
    alert("请先登录 costco.com 并打开 “Account > Orders & Purchases” 页面后重试。");
    return;
  }

  try {
    const selected = loadSelectedWarehouse() ?? (await discoverWarehouse(idToken, clientId));
    const warehouseNumber = String(selected?.id ?? 847);
    const ui = showProgress();

    try {
      const result = await syncOrdersAndProducts({
        idToken,
        clientId,
        warehouseNumber,
        onProgress: ui.update,
      });
      ui.done(formatSummary(result));
    } catch (err) {
      console.error("同步失败", err);
      ui.remove();
      alert("同步失败，请先登录 costco.com，并打开 “Account > Orders & Purchases” 页面后重试。");
    }
  } catch (err) {
    console.error("获取账单失败", err);
    alert("获取账单失败，请先登录 costco.com，并打开 “Account > Orders & Purchases” 页面后重试。");
  }
}

// ponytail: 纯 DOM 按钮而非 GM_registerMenuCommand / @run-at context-menu —— 两者在
// quoid/userscripts (iOS Safari) 上都不支持，按钮方案跨扩展通用。
function addTriggerButton(): void {
  const button = document.createElement("button");
  button.textContent = "开始使用";
  button.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;padding:8px 14px;" +
    "background:#005dab;color:#fff;border:none;border-radius:4px;cursor:pointer;" +
    "font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.3);";
  button.addEventListener("click", run);
  document.body.appendChild(button);
}

addTriggerButton();
