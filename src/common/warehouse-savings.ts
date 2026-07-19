export type DealApplicability = "warehouse_online" | "warehouse_only" | "online_only" | "unknown";

export interface Money {
  currency: "USD";
  cents: number;
}

export interface RawOffer {
  prependText: string;
  values: string[];
  appendText: string;
  displayText: string;
}

interface OfferBase {
  raw: RawOffer;
}

export type DealOffer =
  | (OfferBase & { kind: "saving_only"; saving: Money })
  | (OfferBase & { kind: "saving_range"; minSaving: Money; maxSaving: Money })
  | (OfferBase & {
      kind: "final_price_after_discount";
      finalPrice: Money;
      saving: Money;
      regularPrice: Money;
      regularPriceDerived: true;
    })
  | (OfferBase & { kind: "displayed_price_only"; price: Money })
  | (OfferBase & {
      kind: "displayed_price_range";
      minPrice: Money;
      maxPrice: Money;
    })
  | (OfferBase & { kind: "incentive"; money?: Money; percent?: number })
  | (OfferBase & { kind: "unstructured" });

export interface WarehouseDeal {
  category: string;
  title: string;
  itemNumber: string | null;
  productId: string | null;
  couponType: string | null;
  applicability: DealApplicability;
  url: string | null;
  imageUrl: string | null;
  offerDetails: string | null;
  offerTerms: string | null;
  additionalText: string | null;
  offer: DealOffer;
}

export interface DealCategory {
  name: string;
  deals: WarehouseDeal[];
}

export interface CampaignDates {
  start: string;
  end: string;
}

export interface WarehouseSavingsResult {
  source: "rsc" | "dom";
  campaignDates: CampaignDates | null;
  categories: DealCategory[];
  deals: WarehouseDeal[];
}

interface RawOfferInput {
  prependText?: unknown;
  values?: unknown;
  appendText?: unknown;
  addCurrency?: unknown;
  renderedValues?: unknown;
}

interface UnknownRecord {
  [key: string]: unknown;
}

const RSC_PUSH_MARKER = "self.__next_f.push(";

/**
 * Parses a fetched Costco Warehouse Savings HTML document.
 *
 * Embedded Next.js RSC data is preferred because it contains structured item
 * numbers and applicability. The rendered DOM is used as a fallback. Scripts
 * from the fetched document are never executed.
 */
export function parseWarehouseSavingsHtml(html: string): WarehouseSavingsResult {
  const campaignDates = parseCampaignDates(html);
  const rscCategories = parseEmbeddedWarehouseSavings(html);
  if (rscCategories.length > 0) {
    return createResult("rsc", campaignDates, rscCategories);
  }

  if (typeof DOMParser === "undefined") {
    throw new Error("Warehouse Savings RSC data was not found and DOMParser is unavailable");
  }

  const domCategories = parseRenderedWarehouseSavings(html);
  if (domCategories.length === 0) {
    throw new Error("The document does not contain recognizable Warehouse Savings data");
  }
  return createResult("dom", campaignDates, domCategories);
}

/** Pure parser for the structured Next.js data embedded in the HTML. */
export function parseEmbeddedWarehouseSavings(html: string): DealCategory[] {
  const sets = new Map<string, UnknownRecord>();

  for (const script of extractScriptContents(html)) {
    let markerIndex = script.indexOf(RSC_PUSH_MARKER);
    while (markerIndex !== -1) {
      const jsonStart = markerIndex + RSC_PUSH_MARKER.length;
      const argument = extractJsonValue(script, jsonStart);
      if (!argument) break;

      try {
        const pushArguments: unknown = JSON.parse(argument.value);
        collectCouponSetsFromPushArguments(pushArguments, sets);
      } catch {
        // Other Flight chunks may not be JSON-shaped data chunks.
      }

      markerIndex = script.indexOf(RSC_PUSH_MARKER, argument.end);
    }
  }

  return [...sets.values()]
    .map(parseRscCouponSet)
    .filter((category): category is DealCategory => category !== null);
}

/** Pure normalization logic shared by RSC and DOM inputs. */
export function classifyDealOffer(input: RawOfferInput): DealOffer {
  const prependText = cleanText(input.prependText);
  const appendText = cleanText(input.appendText);
  const sourceValues = Array.isArray(input.values) ? input.values : [];
  const values = sourceValues.map(cleanText).filter(Boolean);
  const renderedValues = Array.isArray(input.renderedValues)
    ? input.renderedValues.map(cleanText).filter(Boolean)
    : values.map((value) => {
        if (input.addCurrency === true) return `$${value}`;
        if (input.addCurrency === false) return `${value}%`;
        return value;
      });
  const displayText = cleanText(
    [prependText, renderedValues.join(renderedValues.length > 1 ? " - " : ""), appendText]
      .filter(Boolean)
      .join(" "),
  );
  const raw: RawOffer = { prependText, values: renderedValues, appendText, displayText };

  const afterDiscount = appendText.match(/^After\s+\$\s*([\d,]+(?:\.\d{1,2})?)\s+OFF\b/i);
  if (afterDiscount && renderedValues.length === 1) {
    const finalPrice = parseMoney(renderedValues[0]);
    const saving = parseMoney(afterDiscount[1]);
    if (finalPrice && saving) {
      return {
        kind: "final_price_after_discount",
        finalPrice,
        saving,
        regularPrice: money(finalPrice.cents + saving.cents),
        regularPriceDerived: true,
        raw,
      };
    }
  }

  if (/^save\s*$/i.test(prependText)) {
    const amounts = renderedValues.map(parseMoney);
    if (amounts.length === 1 && amounts[0]) {
      return { kind: "saving_only", saving: amounts[0], raw };
    }
    if (amounts.length === 2 && amounts[0] && amounts[1]) {
      return { kind: "saving_range", minSaving: amounts[0], maxSaving: amounts[1], raw };
    }
  }

  if (/^receive\b/i.test(prependText) && renderedValues.length === 1) {
    const percent = parsePercent(renderedValues[0]);
    if (percent !== null) return { kind: "incentive", percent, raw };
    const incentiveMoney = parseMoney(renderedValues[0]);
    if (incentiveMoney) return { kind: "incentive", money: incentiveMoney, raw };
    return { kind: "incentive", raw };
  }

  if (!prependText && !appendText) {
    const amounts = renderedValues.map(parseMoney);
    if (amounts.length === 1 && amounts[0]) {
      return { kind: "displayed_price_only", price: amounts[0], raw };
    }
    if (amounts.length === 2 && amounts[0] && amounts[1]) {
      return { kind: "displayed_price_range", minPrice: amounts[0], maxPrice: amounts[1], raw };
    }
  }

  return { kind: "unstructured", raw };
}

export function parseCampaignDates(html: string): CampaignDates | null {
  const match = html.match(
    /\bValid\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i,
  );
  return match ? { start: match[1], end: match[2] } : null;
}

function createResult(
  source: WarehouseSavingsResult["source"],
  campaignDates: CampaignDates | null,
  categories: DealCategory[],
): WarehouseSavingsResult {
  return { source, campaignDates, categories, deals: categories.flatMap(({ deals }) => deals) };
}

function collectCouponSetsFromPushArguments(
  pushArguments: unknown,
  sets: Map<string, UnknownRecord>,
): void {
  if (!Array.isArray(pushArguments)) return;

  for (const value of pushArguments) {
    if (typeof value !== "string") continue;
    for (const line of value.split("\n")) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const body = line.slice(colon + 1).trim();
      if (!body.startsWith("[") && !body.startsWith("{")) continue;
      try {
        walkForCouponSets(JSON.parse(body), sets);
      } catch {
        // React Flight also contains non-JSON row types; ignore those rows.
      }
    }
  }
}

function walkForCouponSets(value: unknown, sets: Map<string, UnknownRecord>): void {
  if (Array.isArray(value)) {
    for (const child of value) walkForCouponSets(child, sets);
    return;
  }
  if (!isRecord(value)) return;

  if (typeof value.couponSetId === "string" && Array.isArray(value.couponCards)) {
    const uniqueId = cleanText(value.uniqueId);
    const key = uniqueId || cleanText(value.couponSetId);
    const existing = sets.get(key);
    if (!existing || cardCount(value) > cardCount(existing)) sets.set(key, value);
    return;
  }

  for (const child of Object.values(value)) walkForCouponSets(child, sets);
}

function parseRscCouponSet(set: UnknownRecord): DealCategory | null {
  const name = cleanText(set.couponSetId);
  if (!name || !Array.isArray(set.couponCards)) return null;

  const deals = set.couponCards
    .map((card) => parseRscCard(name, card))
    .filter((deal): deal is WarehouseDeal => deal !== null);
  return { name, deals };
}

function parseRscCard(category: string, value: unknown): WarehouseDeal | null {
  if (!isRecord(value)) return null;
  const title = cleanText(value.cardDescription);
  if (!title) return null;

  const price = Array.isArray(value.pricesOffCSObject)
    ? value.pricesOffCSObject.find(isRecord)
    : undefined;
  const link = isRecord(value.couponLink) ? value.couponLink : undefined;
  const firstImage = Array.isArray(value.productImage)
    ? value.productImage.find(isRecord)
    : undefined;

  return {
    category,
    title,
    itemNumber: nullableText(value.itemNumber),
    productId: nullableText(value.productId),
    couponType: nullableText(value.couponType),
    applicability: parseApplicability(value.applicability),
    url: nullableText(link?.url),
    imageUrl: nullableText(firstImage?.url),
    offerDetails: nullableText(value.offerDetails),
    offerTerms: nullableText(value.offerTerms),
    additionalText: nullableText(value.validDatesOverride),
    offer: classifyDealOffer({
      prependText: price?.prepend_text,
      values: price?.value,
      appendText: price?.append_text,
      addCurrency: price?.add_currency,
    }),
  };
}

function parseRenderedWarehouseSavings(html: string): DealCategory[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const categories: DealCategory[] = [];

  for (const categoryElement of document.querySelectorAll<HTMLElement>(
    '[data-testid^="coupon-set-"]',
  )) {
    const name =
      textOf(categoryElement.querySelector("h2")) ||
      cleanText(categoryElement.dataset.testid?.slice("coupon-set-".length));
    if (!name) continue;

    const grids = [...categoryElement.querySelectorAll<HTMLElement>('[data-testid="Grid"]')];
    const container = grids.find((grid) =>
      [...grid.children].some(
        (child) => child instanceof HTMLElement && child.dataset.testid === "Grid",
      ),
    );
    if (!container) continue;

    const deals = [...container.children]
      .filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.dataset.testid === "Grid",
      )
      .map((card) => parseDomCard(name, card))
      .filter((deal): deal is WarehouseDeal => deal !== null);
    categories.push({ name, deals });
  }

  return categories;
}

function parseDomCard(category: string, card: HTMLElement): WarehouseDeal | null {
  const titleLink = card.querySelector<HTMLAnchorElement>('a[data-testid="Link"]');
  const description = card.querySelector<HTMLElement>('[id$="-item-description"]');
  const title = textOf(description) || textOf(titleLink);
  if (!title) return null;

  const priceElements = [
    ...card.querySelectorAll<HTMLElement>('[data-testid="Text_prices_and_percentages_prices"]'),
  ];
  const renderedValues = priceElements.map(textOf).filter(Boolean);
  const cardText = textOf(card);
  const itemMatch = cardText.match(/\bItem\s+([\w-]+)/i);
  const image = card.querySelector<HTMLImageElement>('img[data-testid="media-asset"]');

  return {
    category,
    title,
    itemNumber: itemMatch?.[1] ?? null,
    productId: null,
    couponType: null,
    applicability: parseDomApplicability(card),
    url: titleLink?.getAttribute("href") || null,
    imageUrl: image?.getAttribute("src") || null,
    offerDetails: null,
    offerTerms: null,
    additionalText: null,
    offer: classifyDealOffer({
      prependText: textOf(
        card.querySelector('[data-testid="Text_prices_and_percentages_prepend_text"]'),
      ),
      values: renderedValues,
      renderedValues,
      appendText: textOf(
        card.querySelector('[data-testid="Text_prices_and_percentages_append_text"]'),
      ),
    }),
  };
}

function parseDomApplicability(card: HTMLElement): DealApplicability {
  const labels = new Set(
    [...card.querySelectorAll('[data-testid="Text"]')].map((element) => textOf(element)),
  );
  if (labels.has("Online Only")) return "online_only";
  if (labels.has("Warehouse Only")) return "warehouse_only";
  if (labels.has("Warehouse & Online")) return "warehouse_online";
  return "unknown";
}

function extractScriptContents(html: string): string[] {
  const scripts: string[] = [];
  const lower = html.toLowerCase();
  let position = 0;

  while (true) {
    const open = lower.indexOf("<script", position);
    if (open === -1) break;
    const contentStart = lower.indexOf(">", open + 7);
    if (contentStart === -1) break;
    const close = lower.indexOf("</script", contentStart + 1);
    if (close === -1) break;
    scripts.push(html.slice(contentStart + 1, close));
    const closeEnd = lower.indexOf(">", close + 8);
    position = closeEnd === -1 ? close + 8 : closeEnd + 1;
  }

  return scripts;
}

function extractJsonValue(text: string, start: number): { value: string; end: number } | null {
  let index = start;
  while (/\s/.test(text[index] ?? "")) index += 1;
  if (text[index] !== "[" && text[index] !== "{") return null;

  const opening = text[index];
  const closing = opening === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let cursor = index; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === opening) depth += 1;
    else if (character === closing && --depth === 0) {
      return { value: text.slice(index, cursor + 1), end: cursor + 1 };
    }
  }
  return null;
}

function parseMoney(value: string): Money | null {
  const normalized = value.trim().replace(/^\$/, "").replaceAll(",", "");
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return money(Number(match[1]) * 100 + Number(fraction || "0"));
}

function parsePercent(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) : null;
}

function money(cents: number): Money {
  return { currency: "USD", cents };
}

function parseApplicability(value: unknown): DealApplicability {
  return value === "warehouse_online" || value === "warehouse_only" || value === "online_only"
    ? value
    : "unknown";
}

function cardCount(value: UnknownRecord): number {
  return Array.isArray(value.couponCards) ? value.couponCards.length : 0;
}

function textOf(element: Element | null): string {
  return cleanText(element?.textContent);
}

function nullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text || null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
