import { POLYMARKET_GAMMA_URL, POLYMARKET_SLUG } from "./config.js";

export type PolymarketReference = {
  slug: string;
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  updatedAt: string | null;
};

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizePolymarketReference(raw: unknown): PolymarketReference {
  if (!raw || typeof raw !== "object") throw new Error("invalid Gamma market payload");
  const market = raw as Record<string, unknown>;
  const outcomes = jsonArray(market.outcomes).map(String);
  const prices = jsonArray(market.outcomePrices).map(Number);
  if (!market.slug || !market.conditionId || outcomes.length !== 2 || prices.length !== 2 || prices.some((p) => !Number.isFinite(p))) {
    throw new Error("Polymarket mirror must be a binary CLOB market");
  }
  const yes = outcomes.findIndex((outcome) => outcome.toLowerCase() === "yes");
  const no = outcomes.findIndex((outcome) => outcome.toLowerCase() === "no");
  const yesIndex = yes >= 0 ? yes : 0;
  const noIndex = no >= 0 ? no : 1;
  return {
    slug: String(market.slug),
    conditionId: String(market.conditionId),
    question: String(market.question ?? market.slug),
    yesPrice: prices[yesIndex],
    noPrice: prices[noIndex],
    active: market.active === true,
    closed: market.closed === true,
    acceptingOrders: market.acceptingOrders === true,
    updatedAt: market.updatedAt ? String(market.updatedAt) : null,
  };
}

export async function readPolymarketReference(): Promise<PolymarketReference | null> {
  if (!POLYMARKET_SLUG) return null;
  const url = new URL("/markets", POLYMARKET_GAMMA_URL);
  url.searchParams.set("slug", POLYMARKET_SLUG);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json", "user-agent": "subrosa-agent/0.1" },
  });
  if (!response.ok) throw new Error(`Polymarket Gamma ${response.status}`);
  const payload: unknown = await response.json();
  const market = Array.isArray(payload) ? payload[0] : payload;
  if (!market) throw new Error(`Polymarket market not found: ${POLYMARKET_SLUG}`);
  return normalizePolymarketReference(market);
}
