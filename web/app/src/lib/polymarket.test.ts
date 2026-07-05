import { describe, expect, it } from "vitest";
import { normalizePolymarketMarket } from "./polymarket";

describe("normalizePolymarketMarket", () => {
  it("normalizes Gamma's string-encoded binary arrays", () => {
    const quote = normalizePolymarketMarket({
      id: "1",
      slug: "will-it-happen",
      conditionId: "0xabc",
      question: "Will it happen?",
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.42", "0.58"]',
      volumeNum: 123,
      liquidity: "45.5",
      bestBid: 0.41,
      bestAsk: 0.43,
      active: true,
      closed: false,
      acceptingOrders: true,
    });

    expect(quote.yesPrice).toBe(0.42);
    expect(quote.noPrice).toBe(0.58);
    expect(quote.volume).toBe(123);
    expect(quote.liquidity).toBe(45.5);
  });

  it("rejects markets that cannot map to two Miden outcomes", () => {
    expect(() => normalizePolymarketMarket({
      slug: "multi",
      conditionId: "0xdef",
      outcomes: '["A", "B", "C"]',
      outcomePrices: '["0.2", "0.3", "0.5"]',
    })).toThrow(/binary CLOB market/);
  });
});
