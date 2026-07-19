import { parseWarehouseSavingsHtml, type WarehouseSavingsResult } from "./warehouse-savings";

const WAREHOUSE_SAVINGS_URL = "https://www.costco.com/o/-/warehouse-savings";

export interface FetchWarehouseSavingsOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function fetchWarehouseSavings({
  signal,
  fetchImpl = fetch,
}: FetchWarehouseSavingsOptions = {}): Promise<WarehouseSavingsResult> {
  const response = await fetchImpl(WAREHOUSE_SAVINGS_URL, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif," +
        "image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,ja;q=0.6",
      "cache-control": "max-age=0",
    },
    referrer: "https://www.costco.com/w/-/locations",
    method: "GET",
    mode: "cors",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Warehouse Savings request failed: HTTP ${response.status}`);
  }
  return parseWarehouseSavingsHtml(await response.text());
}
