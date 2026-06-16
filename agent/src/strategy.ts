import type { MarketOdds } from "./onchain.js";

export type Decision = { side: "yes" | "no"; size: bigint; reason: string } | null;

// Trivial value strategy (the "brain" is off-chain and private). Implied
// P(YES) = no/(yes+no) per the CPMM convention. If a side looks underpriced
// vs a fair 50/50 prior, take it; size scales with conviction. Real strategies
// (Polybaskets logic) plug in here without changing the guardrail wiring.
export function decide(odds: MarketOdds): Decision {
  if (odds.resolution !== 0n) return null; // resolved → no trading
  const total = odds.yes + odds.no;
  if (total === 0n) return null;

  const yesProbBps = Number((odds.no * 10000n) / total); // basis points (0..10000)
  const edgeBps = yesProbBps - 5000; // vs 50/50 prior
  const conviction = Math.min(Math.abs(edgeBps) / 100, 20); // 0..20
  if (conviction < 2) return null; // no edge → skip

  const size = BigInt(Math.round(conviction)) * 50n; // 100..1000 OBX
  return edgeBps < 0
    ? { side: "yes", size, reason: `YES underpriced @ ${(yesProbBps / 100).toFixed(1)}%` }
    : { side: "no", size, reason: `NO underpriced @ ${(100 - yesProbBps / 100).toFixed(1)}%` };
}
