/**
 * Client for Costco's `receiptsWithCounts` GraphQL query.
 */

const ENDPOINT = "https://ecom-api.costco.com/ebusiness/order/v1/orders/graphql";
const PRODUCT_ENDPOINT = "https://ecom-api.costco.com/ebusiness/product/v1/products/graphql";

/** Static identifier for the Costco web app itself — not user-specific. */
const CLIENT_IDENTIFIER = "481b1aec-aa3b-454b-b81b-48187e28f205";

/* -------------------------------------------------------------------------- */
/* Response types                                                             */
/* -------------------------------------------------------------------------- */

export type DocumentType = "warehouse" | "gasStation" | "carWash" | "gasStationWithCarWash";

export interface ReceiptItem {
  itemNumber: string;
  itemDescription01: string | null;
  frenchItemDescription1: string | null;
  itemDescription02: string | null;
  frenchItemDescription2: string | null;
  itemIdentifier: string | null;
  itemDepartmentNumber: number | null;
  unit: number | null;
  amount: number;
  /** 'Y' | 'N' in practice, but keep it loose. */
  taxFlag: string | null;
  merchantID: string | null;
  entryMethod: string | null;
  transDepartmentNumber: number | null;
  fuelUnitQuantity: number | null;
  fuelGradeCode: string | null;
  itemUnitPriceAmount: number | null;
  fuelUomCode: string | null;
  fuelUomDescription: string | null;
  fuelUomDescriptionFr: string | null;
  fuelGradeDescription: string | null;
  fuelGradeDescriptionFr: string | null;
}

export interface ReceiptTender {
  tenderTypeCode: string | null;
  tenderSubTypeCode: string | null;
  tenderDescription: string | null;
  amountTender: number;
  displayAccountNumber: string | null;
  sequenceNumber: number | null;
  approvalNumber: string | null;
  responseCode: string | null;
  tenderTypeName: string | null;
  tenderTypeNameFr: string | null;
  transactionID: string | null;
  merchantID: string | null;
  entryMethod: string | null;
  tenderAcctTxnNumber: string | null;
  tenderAuthorizationCode: string | null;
  tenderEntryMethodDescription: string | null;
  walletType: string | null;
  walletId: string | null;
  storedValueBucket: string | null;
}

export interface ReceiptSubTaxes {
  tax1: number | null;
  tax2: number | null;
  tax3: number | null;
  tax4: number | null;
  aTaxPercent: number | null;
  aTaxLegend: string | null;
  aTaxAmount: number | null;
  aTaxPrintCode: string | null;
  aTaxPrintCodeFR: string | null;
  aTaxIdentifierCode: string | null;
  bTaxPercent: number | null;
  bTaxLegend: string | null;
  bTaxAmount: number | null;
  bTaxPrintCode: string | null;
  bTaxPrintCodeFR: string | null;
  bTaxIdentifierCode: string | null;
  cTaxPercent: number | null;
  cTaxLegend: string | null;
  cTaxAmount: number | null;
  cTaxIdentifierCode: string | null;
  dTaxPercent: number | null;
  dTaxLegend: string | null;
  dTaxAmount: number | null;
  dTaxPrintCode: string | null;
  dTaxPrintCodeFR: string | null;
  dTaxIdentifierCode: string | null;
  uTaxLegend: string | null;
  uTaxAmount: number | null;
  uTaxableAmount: number | null;
}

/** Known values observed for {@link Receipt.receiptType}; carWash variants unconfirmed. */
export type ReceiptType = "In-Warehouse" | "Gas Station" | (string & {});

/** Known values observed for {@link Receipt.documentType}; distinct from the query-level {@link DocumentType}. */
export type ReceiptDocumentType = "WarehouseReceiptDetail" | "FuelReceipts" | (string & {});

export interface Receipt {
  warehouseName: string;
  receiptType: ReceiptType;
  documentType: ReceiptDocumentType;
  /** ISO-ish local timestamp, e.g. "2026-06-29T11:37:00" (no timezone offset). */
  transactionDateTime: string;
  /** "YYYY-MM-DD" */
  transactionDate: string;
  companyNumber: number;
  warehouseNumber: number;
  operatorNumber: number;
  warehouseShortName: string;
  registerNumber: number;
  transactionNumber: number;
  /** Negative totals on refunds. */
  transactionType: "Sales" | "Refund";
  transactionBarcode: string;
  warehouseAddress1: string | null;
  warehouseAddress2: string | null;
  warehouseCity: string | null;
  warehouseState: string | null;
  warehouseCountry: string | null;
  warehousePostalCode: string | null;
  totalItemCount: number;
  subTotal: number;
  taxes: number;
  total: number;
  invoiceNumber: number | null;
  sequenceNumber: number | null;
  itemArray: ReceiptItem[];
  tenderArray: ReceiptTender[];
  subTaxes: ReceiptSubTaxes | null;
  instantSavings: number;
  membershipNumber: string;
}

/**
 * A discounted product shows up as two lines: the product at full price, and a
 * separate discount line whose `itemDescription01` is `"/ <itemNumber>"` and
 * whose `amount` is the (negative) discount. {@link mergeReceiptItemDiscounts}
 * folds the discount line into its target as the `discount` field.
 */
export interface MergedReceiptItem extends ReceiptItem {
  /** Discount amount, kept as the raw negative value; 0 when none. Net = amount + discount. */
  discount: number;
}

export type MergedReceipt = Omit<Receipt, "itemArray"> & {
  itemArray: MergedReceiptItem[];
};

/** Raw date-range response, before discount merge. */
interface ReceiptsWithCountsRaw {
  inWarehouse: number;
  gasStation: number;
  carWash: number;
  gasAndCarWash: number;
  receipts: Receipt[];
}

/** Date-range response, with each receipt's `itemArray` discount-merged. */
export interface ReceiptsWithCounts {
  inWarehouse: number;
  gasStation: number;
  carWash: number;
  gasAndCarWash: number;
  receipts: MergedReceipt[];
}

/** Matches a discount line like "/ 27003" or "/27003", capturing the target itemNumber. */
const DISCOUNT_REF = /^\s*\/\s*(\d+)\s*$/;

/**
 * Fold discount lines into the products they reference. A discount line's
 * `amount` is added to the target product's `discount`. Discount lines with no
 * matching product are passed through unchanged (with `discount: 0`).
 */
export function mergeReceiptItemDiscounts(items: ReceiptItem[]): MergedReceiptItem[] {
  const result: MergedReceiptItem[] = [];
  const firstIndexByItem = new Map<string, number>();

  for (const item of items) {
    const ref =
      item.itemDescription01?.match(DISCOUNT_REF) ??
      item.frenchItemDescription1?.match(DISCOUNT_REF);
    const target = ref ? firstIndexByItem.get(ref[1]) : undefined;

    if (ref && target !== undefined) {
      result[target].discount += item.amount;
      continue;
    }

    if (!firstIndexByItem.has(item.itemNumber)) {
      firstIndexByItem.set(item.itemNumber, result.length);
    }
    result.push({ ...item, discount: 0 });
  }

  return result;
}

export interface GraphQLError {
  message: string;
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T> {
  data: T | null;
  errors?: GraphQLError[];
}

/* -------------------------------------------------------------------------- */
/* Request                                                                    */
/* -------------------------------------------------------------------------- */

export interface CostcoAuth {
  /** Raw JWT, without the "Bearer " prefix. */
  idToken: string;
  clientId: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Override for testing / non-browser runtimes. */
  fetchImpl?: typeof fetch;
}

export type DocumentSubType = "all" | "sales" | "refunds";

export interface ReceiptsByDateRangeVariables {
  /** "M/DD/YYYY", e.g. "5/01/2026". Not ISO — the API is picky. */
  startDate: string;
  endDate: string;
  documentType: DocumentType;
  documentSubType: DocumentSubType;
}

export interface FetchReceiptsByDateRangeOptions
  extends
    CostcoAuth,
    RequestOptions,
    Partial<Pick<ReceiptsByDateRangeVariables, "documentType" | "documentSubType">> {
  /** Accepts a Date or a pre-formatted "M/DD/YYYY" string. */
  startDate: Date | string;
  endDate: Date | string;
}

export class CostcoApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly errors?: GraphQLError[],
  ) {
    super(message);
    this.name = "CostcoApiError";
  }
}

const RECEIPTS_BY_DATE_RANGE_QUERY = /* GraphQL */ `
  query receiptsWithCounts(
    $startDate: String!
    $endDate: String!
    $documentType: String!
    $documentSubType: String!
  ) {
    receiptsWithCounts(
      startDate: $startDate
      endDate: $endDate
      documentType: $documentType
      documentSubType: $documentSubType
    ) {
      inWarehouse
      gasStation
      carWash
      gasAndCarWash
      receipts {
        warehouseName
        receiptType
        documentType
        transactionDateTime
        transactionDate
        companyNumber
        warehouseNumber
        operatorNumber
        warehouseShortName
        registerNumber
        transactionNumber
        transactionType
        transactionBarcode
        warehouseAddress1
        warehouseAddress2
        warehouseCity
        warehouseState
        warehouseCountry
        warehousePostalCode
        totalItemCount
        subTotal
        taxes
        total
        invoiceNumber
        sequenceNumber
        itemArray {
          itemNumber
          itemDescription01
          frenchItemDescription1
          itemDescription02
          frenchItemDescription2
          itemIdentifier
          itemDepartmentNumber
          unit
          amount
          taxFlag
          merchantID
          entryMethod
          transDepartmentNumber
          fuelUnitQuantity
          fuelGradeCode
          itemUnitPriceAmount
          fuelUomCode
          fuelUomDescription
          fuelUomDescriptionFr
          fuelGradeDescription
          fuelGradeDescriptionFr
        }
        tenderArray {
          tenderTypeCode
          tenderSubTypeCode
          tenderDescription
          amountTender
          displayAccountNumber
          sequenceNumber
          approvalNumber
          responseCode
          tenderTypeName
          tenderTypeNameFr
          transactionID
          merchantID
          entryMethod
          tenderAcctTxnNumber
          tenderAuthorizationCode
          tenderEntryMethodDescription
          walletType
          walletId
          storedValueBucket
        }
        subTaxes {
          tax1
          tax2
          tax3
          tax4
          aTaxPercent
          aTaxLegend
          aTaxAmount
          aTaxPrintCode
          aTaxPrintCodeFR
          aTaxIdentifierCode
          bTaxPercent
          bTaxLegend
          bTaxAmount
          bTaxPrintCode
          bTaxPrintCodeFR
          bTaxIdentifierCode
          cTaxPercent
          cTaxLegend
          cTaxAmount
          cTaxIdentifierCode
          dTaxPercent
          dTaxLegend
          dTaxAmount
          dTaxPrintCode
          dTaxPrintCodeFR
          dTaxIdentifierCode
          uTaxLegend
          uTaxAmount
          uTaxableAmount
        }
        instantSavings
        membershipNumber
      }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

function buildHeaders({ idToken, clientId }: CostcoAuth): HeadersInit {
  return {
    accept: "*/*",
    "content-type": "application/json-patch+json",
    "costco-x-authorization": `Bearer ${idToken}`,
    "costco-x-wcs-clientid": clientId,
    "costco.env": "ecom",
    "costco.service": "restOrders",
    "client-identifier": CLIENT_IDENTIFIER,
  };
}

/** The product endpoint is unauthenticated — no bearer token. */
function buildProductHeaders(clientId: string): HeadersInit {
  return {
    accept: "*/*",
    "content-type": "application/json-patch+json",
    "costco-x-wcs-clientId": clientId,
    "costco.env": "ecom",
    "costco.service": "restOrders",
    "client-identifier": CLIENT_IDENTIFIER,
  };
}

async function postGraphQL<TData, TVariables extends object = object>(
  url: string,
  headers: HeadersInit,
  query: string,
  variables: TVariables,
  { signal, fetchImpl = fetch }: RequestOptions,
): Promise<TData> {
  const response = await fetchImpl(url, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new CostcoApiError(
      `Costco API returned ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  const payload = (await response.json()) as GraphQLResponse<TData>;

  if (payload.errors?.length) {
    throw new CostcoApiError(payload.errors[0].message, response.status, payload.errors);
  }

  if (!payload.data) {
    throw new CostcoApiError("Costco API returned no data", response.status);
  }

  return payload.data;
}

/** The API wants "M/DD/YYYY" (unpadded month, padded day) in US locale. */
export function formatCostcoDate(date: Date | string): string {
  if (typeof date === "string") return date;
  const month = date.getMonth() + 1;
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fetch full-detail receipts within a date range, plus per-category counts.
 * Each receipt's `itemArray` has its discount lines folded in via
 * {@link mergeReceiptItemDiscounts}.
 *
 * @throws {CostcoApiError} on non-2xx responses or GraphQL errors.
 */
export async function fetchReceiptsByDateRange({
  idToken,
  clientId,
  startDate,
  endDate,
  documentType = "warehouse",
  documentSubType = "all",
  ...request
}: FetchReceiptsByDateRangeOptions): Promise<ReceiptsWithCounts> {
  const variables: ReceiptsByDateRangeVariables = {
    startDate: formatCostcoDate(startDate),
    endDate: formatCostcoDate(endDate),
    documentType,
    documentSubType,
  };

  const data = await postGraphQL<{ receiptsWithCounts: ReceiptsWithCountsRaw }>(
    ENDPOINT,
    buildHeaders({ idToken, clientId }),
    RECEIPTS_BY_DATE_RANGE_QUERY,
    variables,
    request,
  );

  const { receipts, ...counts } = data.receiptsWithCounts;
  return {
    ...counts,
    receipts: receipts.map((receipt) => ({
      ...receipt,
      itemArray: mergeReceiptItemDiscounts(receipt.itemArray),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export interface ProductFieldData {
  imageName: string | null;
}

export interface ProductDescription {
  shortDescription: string | null;
}

/** Decimal strings, e.g. "579.99000". `listPrice` is "-1.00000" when unset. */
export interface ProductPriceData {
  price: string | null;
  listPrice: string | null;
}

export interface ProductAdditionalFieldData {
  minItemOrderQty: string | null;
  fsa: number | null;
  chdIndicator: number | null;
}

export interface ProductCatalogEntry {
  itemNumber: string;
  /** Comma-delimited flags, e.g. "Google,SiteControlledInventory,Standard,ShipIt". */
  programTypes: string | null;
  /** Aliased from `itemId` in the query. */
  catEntryId: string | null;
  published: boolean;
  priceData: ProductPriceData | null;
  fieldData: ProductFieldData | null;
  description: ProductDescription | null;
  additionalFieldData: ProductAdditionalFieldData | null;
  parentData: { fieldData: ProductFieldData | null } | null;
}

export interface ProductFulfillmentField1Data {
  replacedItem: string | null;
  replacementType: string | null;
}

export interface ProductFulfillmentEntry {
  itemNumber: string;
  field1Data: ProductFulfillmentField1Data | null;
}

export interface ProductsQueryData {
  products: {
    catalogData: ProductCatalogEntry[] | null;
    fulfillmentData: ProductFulfillmentEntry[] | null;
  };
}

/** Flattened, UI-friendly shape. */
export interface ProductDetail {
  itemNumber: string;
  itemActualName: string;
  fullItemImage: string;
  catEntryId: string;
  published: boolean;
  /** Numeric parse of `priceData.price`; null when absent or unparseable. */
  price: number | null;
  /** Null when the sentinel -1 is returned (i.e. no list price). */
  listPrice: number | null;
  programTypes: string[];
  minItemOrderQty: number | null;
  fsa: number | null;
  chdIndicator: number | null;
  replacedItem: string | null;
  replacementType: string | null;
}

export type ProductDetailMap = Record<string, ProductDetail>;

export interface FetchBatchItemDetailsOptions extends RequestOptions {
  itemNumbers: string[];
  clientId: string;
  warehouseNumber: string;
  locale?: string[];
  /** Items per GraphQL request. */
  chunkSize?: number;
  onProgress?: (done: number, total: number) => void;
  /**
   * When true (default), a failed chunk is logged and skipped rather than
   * rejecting the whole batch — matching the original JS behavior.
   */
  tolerateChunkFailures?: boolean;
}

const PRODUCTS_QUERY = /* GraphQL */ `
  query products(
    $clientId: String!
    $itemNumbers: [String]
    $locale: [String]
    $warehouseNumber: String!
  ) {
    products(
      clientId: $clientId
      itemNumbers: $itemNumbers
      locale: $locale
      warehouseNumber: $warehouseNumber
    ) {
      catalogData {
        itemNumber
        programTypes
        catEntryId: itemId
        published
        priceData {
          price
          listPrice
        }
        fieldData {
          imageName
        }
        parentData {
          fieldData {
            imageName
          }
        }
        additionalFieldData {
          minItemOrderQty
          fsa
          chdIndicator
        }
        description {
          shortDescription
        }
      }
      fulfillmentData {
        itemNumber
        field1Data {
          replacedItem
          replacementType
        }
      }
    }
  }
`;

/** Costco returns decimals as strings; -1 is the "unset" sentinel for listPrice. */
function parseAmount(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toProductMap(
  catalogData: ProductCatalogEntry[] | null,
  fulfillmentData: ProductFulfillmentEntry[] | null,
): ProductDetailMap {
  const result: ProductDetailMap = {};
  if (!catalogData) return result;

  const fulfillmentByItem = new Map<string, ProductFulfillmentEntry>(
    (fulfillmentData ?? []).map((f) => [f.itemNumber, f]),
  );

  for (const entry of catalogData) {
    if (!entry?.itemNumber) continue;

    const fulfillment = fulfillmentByItem.get(entry.itemNumber)?.field1Data ?? null;
    const listPrice = parseAmount(entry.priceData?.listPrice);

    result[entry.itemNumber] = {
      itemNumber: entry.itemNumber,
      itemActualName: entry.description?.shortDescription ?? "",
      fullItemImage: entry.fieldData?.imageName ?? entry.parentData?.fieldData?.imageName ?? "",
      catEntryId: entry.catEntryId ?? "",
      published: entry.published,
      price: parseAmount(entry.priceData?.price),
      listPrice: listPrice != null && listPrice >= 0 ? listPrice : null,
      programTypes: entry.programTypes ? entry.programTypes.split(",") : [],
      minItemOrderQty: parseAmount(entry.additionalFieldData?.minItemOrderQty),
      fsa: entry.additionalFieldData?.fsa ?? null,
      chdIndicator: entry.additionalFieldData?.chdIndicator ?? null,
      replacedItem: fulfillment?.replacedItem ?? null,
      replacementType: fulfillment?.replacementType ?? null,
    };
  }
  return result;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch product details for a list of item numbers, batched to avoid API limits.
 * Returns a map keyed by item number; missing/unknown items are simply absent.
 */
export async function fetchBatchItemDetails({
  itemNumbers,
  clientId,
  warehouseNumber,
  locale = ["en-US"],
  chunkSize = 25,
  onProgress,
  tolerateChunkFailures = true,
  ...request
}: FetchBatchItemDetailsOptions): Promise<ProductDetailMap> {
  if (!itemNumbers?.length) return {};

  const headers = buildProductHeaders(clientId);
  const aggregate: ProductDetailMap = {};

  let done = 0;

  for (const batch of chunk(itemNumbers, chunkSize)) {
    try {
      const data = await postGraphQL<ProductsQueryData>(
        PRODUCT_ENDPOINT,
        headers,
        PRODUCTS_QUERY,
        { itemNumbers: batch, clientId, locale, warehouseNumber },
        request,
      );
      Object.assign(
        aggregate,
        toProductMap(data.products?.catalogData ?? null, data.products?.fulfillmentData ?? null),
      );
    } catch (err) {
      if (!tolerateChunkFailures) throw err;
      console.error("Batch product fetch failed:", err);
    } finally {
      done += batch.length;
      onProgress?.(done, itemNumbers.length);
    }
  }

  return aggregate;
}
