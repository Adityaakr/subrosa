import assert from "node:assert/strict";
import test from "node:test";
import { normalizePolymarketReference } from "./polymarket.js";
import { heuristicDecide } from "./strategy.js";

test("normalizes a Gamma binary market", () => {
  const quote = normalizePolymarketReference({
    slug: "mirror",
    conditionId: "0x123",
    question: "Will it happen?",
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.25","0.75"]',
    active: true,
    closed: false,
    acceptingOrders: true,
  });
  assert.equal(quote.yesPrice, 0.25);
  assert.equal(quote.noPrice, 0.75);
});

test("rejects a non-binary market", () => {
  assert.throws(() => normalizePolymarketReference({
    slug: "multi",
    conditionId: "0x456",
    outcomes: '["A","B","C"]',
    outcomePrices: '["0.2","0.3","0.5"]',
  }), /binary CLOB/);
});

test("buys the side underpriced on Miden relative to Polymarket", () => {
  const reference = normalizePolymarketReference({
    slug: "mirror",
    conditionId: "0x123",
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.70","0.30"]',
    active: true,
    closed: false,
  });
  assert.equal(heuristicDecide({ yes: 50n, no: 50n, resolution: 0n }, reference)?.side, "yes");
  assert.equal(heuristicDecide({ yes: 10n, no: 90n, resolution: 0n }, reference)?.side, "no");
});
