import type { WarehouseDeal } from "./warehouse-savings";

export type ExactWarehouseDeal = WarehouseDeal & {
  offer:
    | Extract<WarehouseDeal["offer"], { kind: "final_price_after_discount" }>
    | Extract<WarehouseDeal["offer"], { kind: "saving_only" }>
    | Extract<WarehouseDeal["offer"], { kind: "displayed_price_only" }>;
};

export function isWarehouseApplicable(deal: WarehouseDeal): boolean {
  return deal.applicability === "warehouse_only" || deal.applicability === "warehouse_online";
}

export function buildWarehouseDealIndex(
  deals: readonly WarehouseDeal[],
): Map<string, WarehouseDeal[]> {
  const index = new Map<string, WarehouseDeal[]>();
  for (const deal of deals) {
    if (!deal.itemNumber || !isWarehouseApplicable(deal)) continue;
    const existing = index.get(deal.itemNumber);
    if (existing) existing.push(deal);
    else index.set(deal.itemNumber, [deal]);
  }
  return index;
}

export function selectExactWarehouseDeal(
  deals: readonly WarehouseDeal[] | undefined,
): ExactWarehouseDeal | null {
  if (!deals) return null;
  const supported = deals.filter(isExactWarehouseDeal);
  if (supported.length === 0) return null;

  const bestRank = Math.min(...supported.map(dealRank));
  const preferred = supported.filter((deal) => dealRank(deal) === bestRank);
  const signature = offerSignature(preferred[0]);
  return preferred.every((deal) => offerSignature(deal) === signature) ? preferred[0] : null;
}

export function activeWatchedItemNumbers(
  watchlist: readonly string[],
  index: ReadonlyMap<string, readonly WarehouseDeal[]>,
): string[] {
  return [...new Set(watchlist)].filter((itemNumber) => index.has(itemNumber));
}

function isExactWarehouseDeal(deal: WarehouseDeal): deal is ExactWarehouseDeal {
  return (
    deal.offer.kind === "final_price_after_discount" ||
    deal.offer.kind === "saving_only" ||
    deal.offer.kind === "displayed_price_only"
  );
}

function dealRank(deal: ExactWarehouseDeal): number {
  if (deal.offer.kind === "final_price_after_discount") return 0;
  if (deal.offer.kind === "saving_only") return 1;
  return 2;
}

function offerSignature(deal: ExactWarehouseDeal): string {
  const offer = deal.offer;
  if (offer.kind === "final_price_after_discount") {
    return `${offer.kind}:${offer.finalPrice.cents}:${offer.saving.cents}`;
  }
  if (offer.kind === "saving_only") return `${offer.kind}:${offer.saving.cents}`;
  return `${offer.kind}:${offer.price.cents}`;
}
