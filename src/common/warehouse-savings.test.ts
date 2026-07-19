import { describe, expect, it } from "vitest";
import {
  classifyDealOffer,
  parseCampaignDates,
  parseEmbeddedWarehouseSavings,
} from "./warehouse-savings";

function rscHtml(value: unknown): string {
  const flightRow = `36:${JSON.stringify(value)}\n`;
  return `<html><script>self.__next_f.push(${JSON.stringify([1, flightRow])})</script></html>`;
}

describe("classifyDealOffer", () => {
  it("classifies a saving-only offer", () => {
    expect(
      classifyDealOffer({
        prependText: "Save",
        values: ["5.80"],
        addCurrency: true,
      }),
    ).toMatchObject({
      kind: "saving_only",
      saving: { currency: "USD", cents: 580 },
      raw: { displayText: "Save $5.80" },
    });
  });

  it("classifies a saving range", () => {
    expect(
      classifyDealOffer({
        prependText: "Save",
        values: ["200", "1,200"],
        addCurrency: true,
      }),
    ).toMatchObject({
      kind: "saving_range",
      minSaving: { cents: 20_000 },
      maxSaving: { cents: 120_000 },
    });
  });

  it("derives regular price from final price and the OFF amount", () => {
    expect(
      classifyDealOffer({
        values: ["149.99"],
        appendText: "After $30 OFF",
        addCurrency: true,
      }),
    ).toMatchObject({
      kind: "final_price_after_discount",
      finalPrice: { cents: 14_999 },
      saving: { cents: 3_000 },
      regularPrice: { cents: 17_999 },
      regularPriceDerived: true,
    });
  });

  it("distinguishes displayed prices from savings", () => {
    expect(classifyDealOffer({ values: ["529.99"], addCurrency: true })).toMatchObject({
      kind: "displayed_price_only",
      price: { cents: 52_999 },
    });
    expect(classifyDealOffer({ values: ["45", "110"], addCurrency: true })).toMatchObject({
      kind: "displayed_price_range",
      minPrice: { cents: 4_500 },
      maxPrice: { cents: 11_000 },
    });
  });

  it("classifies money and percentage incentives", () => {
    expect(
      classifyDealOffer({ prependText: "Receive", values: ["450"], addCurrency: true }),
    ).toMatchObject({ kind: "incentive", money: { cents: 45_000 } });
    expect(
      classifyDealOffer({
        prependText: "Receive a",
        values: ["15"],
        appendText: "Costco Shop Card",
        addCurrency: false,
      }),
    ).toMatchObject({ kind: "incentive", percent: 15 });
  });

  it("preserves unknown and non-numeric offers", () => {
    expect(classifyDealOffer({})).toEqual({
      kind: "unstructured",
      raw: { prependText: "", values: [], appendText: "", displayText: "" },
    });
  });
});

describe("parseEmbeddedWarehouseSavings", () => {
  it("extracts structured coupon sets without executing scripts", () => {
    const html = rscHtml([
      "$",
      "$L49",
      null,
      {
        couponSetId: "Grocery",
        uniqueId: "grocery-id",
        couponCards: [
          {
            cardDescription: "Example Product",
            itemNumber: "12345",
            productId: "4000000001",
            couponType: "item",
            applicability: "warehouse_online",
            couponLink: { url: "https://www.costco.com/p/-/4000000001" },
            productImage: [{ url: "https://example.com/product.avif" }],
            offerDetails: "40 oz",
            offerTerms: "Limit 5",
            validDatesOverride: "Selection varies by location.",
            pricesOffCSObject: [
              {
                prepend_text: "",
                value: ["14.99"],
                append_text: "After $5 OFF",
                add_currency: true,
              },
            ],
          },
        ],
      },
    ]);

    expect(parseEmbeddedWarehouseSavings(html)).toEqual([
      {
        name: "Grocery",
        deals: [
          {
            category: "Grocery",
            title: "Example Product",
            itemNumber: "12345",
            productId: "4000000001",
            couponType: "item",
            applicability: "warehouse_online",
            url: "https://www.costco.com/p/-/4000000001",
            imageUrl: "https://example.com/product.avif",
            offerDetails: "40 oz",
            offerTerms: "Limit 5",
            additionalText: "Selection varies by location.",
            offer: {
              kind: "final_price_after_discount",
              finalPrice: { currency: "USD", cents: 1_499 },
              saving: { currency: "USD", cents: 500 },
              regularPrice: { currency: "USD", cents: 1_999 },
              regularPriceDerived: true,
              raw: {
                prependText: "",
                values: ["$14.99"],
                appendText: "After $5 OFF",
                displayText: "$14.99 After $5 OFF",
              },
            },
          },
        ],
      },
    ]);
  });

  it("ignores unrelated and malformed scripts", () => {
    const html = `<script>throw new Error("must not execute")</script>
      <script>self.__next_f.push(notJson)</script>`;
    expect(parseEmbeddedWarehouseSavings(html)).toEqual([]);
  });

  it("keeps the larger duplicate coupon set", () => {
    const smaller = {
      couponSetId: "Pets",
      uniqueId: "same-id",
      couponCards: [],
    };
    const larger = {
      ...smaller,
      couponCards: [
        {
          cardDescription: "Pet Deal",
          pricesOffCSObject: [],
          couponLink: {},
          productImage: [],
        },
      ],
    };
    const html = rscHtml([smaller, larger]);
    expect(parseEmbeddedWarehouseSavings(html)[0]?.deals).toHaveLength(1);
  });
});

describe("parseCampaignDates", () => {
  it("extracts the global campaign date range", () => {
    expect(parseCampaignDates("Pricing | Valid 6/15/26 - 7/19/26")).toEqual({
      start: "6/15/26",
      end: "7/19/26",
    });
  });
});
