export type PolymarketQuote = {
  id: string;
  slug: string;
  conditionId: string;
  question: string;
  outcomes: [string, string];
  prices: [number, number];
  yesPrice: number;
  noPrice: number;
  bestBid: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
  volume: number;
  liquidity: number;
  endDate: string | null;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  updatedAt: string | null;
};

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePolymarketMarket(raw: unknown): PolymarketQuote {
  if (!raw || typeof raw !== "object") throw new Error("Invalid Polymarket market payload");
  const market = raw as Record<string, unknown>;
  const outcomes = parseJsonArray(market.outcomes).map(String);
  const prices = parseJsonArray(market.outcomePrices).map((value) => finiteNumber(value));
  if (!market.slug || !market.conditionId || outcomes.length !== 2 || prices.length !== 2) {
    throw new Error("Polymarket market is not a binary CLOB market");
  }

  const yesIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === "yes");
  const noIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === "no");
  const first = yesIndex >= 0 ? yesIndex : 0;
  const second = noIndex >= 0 ? noIndex : 1;

  return {
    id: String(market.id ?? ""),
    slug: String(market.slug),
    conditionId: String(market.conditionId),
    question: String(market.question ?? market.slug),
    outcomes: [String(outcomes[first]), String(outcomes[second])],
    prices: [prices[first], prices[second]],
    yesPrice: prices[first],
    noPrice: prices[second],
    bestBid: optionalNumber(market.bestBid),
    bestAsk: optionalNumber(market.bestAsk),
    lastTradePrice: optionalNumber(market.lastTradePrice),
    volume: finiteNumber(market.volumeNum ?? market.volume),
    liquidity: finiteNumber(market.liquidityNum ?? market.liquidity),
    endDate: market.endDate ? String(market.endDate) : null,
    active: market.active === true,
    closed: market.closed === true,
    acceptingOrders: market.acceptingOrders === true,
    updatedAt: market.updatedAt ? String(market.updatedAt) : null,
  };
}

export async function fetchPolymarketMarket(slug: string, signal?: AbortSignal): Promise<PolymarketQuote> {
  const response = await fetch(`/api/polymarket/markets?slug=${encodeURIComponent(slug)}`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Polymarket API ${response.status}`);
  const payload = await response.json();
  const raw = Array.isArray(payload) ? payload[0] : payload;
  if (!raw) throw new Error(`Polymarket market not found: ${slug}`);
  return normalizePolymarketMarket(raw);
}
