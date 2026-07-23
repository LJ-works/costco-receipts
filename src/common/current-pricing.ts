import {
  fetchBatchItemDetails,
  type FetchBatchItemDetailsOptions,
  type ProductDetail,
  type ProductDetailMap,
} from "./client";
import { buildWarehouseDealIndex } from "./warehouse-deals";
import type { WarehouseDeal } from "./warehouse-savings";

export type PricingResolution =
  | { source: "warehouse_savings"; deals: readonly WarehouseDeal[] }
  | { source: "product_api_fallback"; product: ProductDetail }
  | { source: "unavailable"; reason: "not_loaded" | "missing_product" | "no_discount" };

export interface PricingLookup {
  readonly warehouseSavingsAvailable: boolean;
  resolve(itemNumber: string): PricingResolution;
}

type FetchProducts = (options: FetchBatchItemDetailsOptions) => Promise<ProductDetailMap>;

export class CurrentPricingContext implements PricingLookup {
  readonly warehouseSavingsAvailable: boolean;
  private readonly dealIndex: Map<string, WarehouseDeal[]>;
  private readonly fallbackProducts: ProductDetailMap = {};
  private readonly attempted = new Set<string>();
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    warehouseDeals: readonly WarehouseDeal[] | null,
    private readonly options: {
      clientId: string;
      warehouseNumber: string;
      fetchProducts?: FetchProducts;
    },
  ) {
    this.warehouseSavingsAvailable = warehouseDeals !== null;
    this.dealIndex = buildWarehouseDealIndex(warehouseDeals ?? []);
  }

  async ensureFallback(itemNumbers: readonly string[]): Promise<void> {
    const waits = new Set<Promise<void>>();
    const fresh = [...new Set(itemNumbers)].filter((itemNumber) => {
      if (this.dealIndex.has(itemNumber)) return false;
      const pending = this.inFlight.get(itemNumber);
      if (pending) {
        waits.add(pending);
        return false;
      }
      return !this.attempted.has(itemNumber);
    });

    if (fresh.length > 0) {
      for (const itemNumber of fresh) this.attempted.add(itemNumber);
      const request = (this.options.fetchProducts ?? fetchBatchItemDetails)({
        itemNumbers: fresh,
        clientId: this.options.clientId,
        warehouseNumber: this.options.warehouseNumber,
      })
        .then((products) => {
          Object.assign(this.fallbackProducts, products);
        })
        .catch((error: unknown) => {
          console.error("Product API fallback failed", error);
        })
        .finally(() => {
          for (const itemNumber of fresh) this.inFlight.delete(itemNumber);
        });
      for (const itemNumber of fresh) this.inFlight.set(itemNumber, request);
      waits.add(request);
    }

    await Promise.all(waits);
  }

  resolve(itemNumber: string): PricingResolution {
    const deals = this.dealIndex.get(itemNumber);
    if (deals) return { source: "warehouse_savings", deals };

    const product = this.fallbackProducts[itemNumber];
    if (product) {
      return isProductApiDiscount(product)
        ? { source: "product_api_fallback", product }
        : { source: "unavailable", reason: "no_discount" };
    }
    return {
      source: "unavailable",
      reason: this.attempted.has(itemNumber) ? "missing_product" : "not_loaded",
    };
  }
}

export function isProductApiDiscount(product: Pick<ProductDetail, "price" | "listPrice">): boolean {
  return (
    product.price !== null &&
    product.listPrice !== null &&
    Number.isFinite(product.price) &&
    Number.isFinite(product.listPrice) &&
    product.listPrice < product.price
  );
}
