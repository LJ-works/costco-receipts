import { fetchReceiptsByDateRange } from "./client";
import { extractWarehouses, formatWarehouseList } from "./warehouses";

const DAYS_BACK = 100;

async function run(): Promise<void> {
  const idToken = localStorage.idToken;
  const clientId = localStorage.clientID;

  if (!idToken || !clientId) {
    alert("未检测到登录信息，请登录 costco.com 或刷新页面后重试。");
    return;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  try {
    const { receipts } = await fetchReceiptsByDateRange({
      idToken,
      clientId,
      startDate,
      endDate,
      documentType: "warehouse",
    });
    alert(formatWarehouseList(extractWarehouses(receipts)));
  } catch (err) {
    console.error("获取账单失败", err);
    alert("获取账单失败，请刷新页面后重试。");
  }
}

// ponytail: 纯 DOM 按钮而非 GM_registerMenuCommand / @run-at context-menu —— 两者在
// quoid/userscripts (iOS Safari) 上都不支持，按钮方案跨扩展通用。
function addTriggerButton(): void {
  const button = document.createElement("button");
  button.textContent = "查询 Costco 消费门店";
  button.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;padding:8px 14px;" +
    "background:#005dab;color:#fff;border:none;border-radius:4px;cursor:pointer;" +
    "font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.3);";
  button.addEventListener("click", run);
  document.body.appendChild(button);
}

addTriggerButton();
