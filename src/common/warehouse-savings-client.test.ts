import { describe, expect, it, vi } from "vitest";
import { fetchWarehouseSavings } from "./warehouse-savings-client";

function fixtureHtml(): string {
  const card = {
    couponSetId: "Grocery",
    uniqueId: "grocery",
    couponCards: [
      {
        cardDescription: "Test Product",
        itemNumber: "123",
        applicability: "warehouse_only",
        couponLink: {},
        productImage: [],
        pricesOffCSObject: [
          { prepend_text: "Save", value: ["5"], append_text: "", add_currency: true },
        ],
      },
    ],
  };
  const row = `36:${JSON.stringify(card)}\n`;
  return `<script>self.__next_f.push(${JSON.stringify([1, row])})</script>`;
}

describe("fetchWarehouseSavings", () => {
  it("fetches and parses the campaign with credentials", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(fixtureHtml(), { status: 200 }));
    const result = await fetchWarehouseSavings({ fetchImpl });
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0]).toMatchObject({ itemNumber: "123", title: "Test Product" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://www.costco.com/o/-/warehouse-savings",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("rejects an HTTP error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status: 503 }));
    await expect(fetchWarehouseSavings({ fetchImpl })).rejects.toThrow("HTTP 503");
  });

  it("rejects a successful response without recognizable savings data", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>not a savings page</html>", { status: 200 }));
    await expect(fetchWarehouseSavings({ fetchImpl })).rejects.toThrow(
      "Warehouse Savings RSC data was not found",
    );
  });
});
