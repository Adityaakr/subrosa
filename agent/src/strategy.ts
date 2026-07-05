import type { MarketOdds } from "./onchain.js";
import type { PolymarketReference } from "./polymarket.js";
import { llmConfigured, llmDecide } from "./llm.js";

export type Decision = { side: "yes" | "no"; size: bigint; reason: string } | null;

// The agent's decision: when OpenRouter is configured, an LLM reasons over the
// live odds (private, off-chain brain); otherwise the heuristic below. The LLM
// path falls back to the heuristic on any error so the loop never stalls.
export async function decide(odds: MarketOdds, reference: PolymarketReference | null = null): Promise<Decision> {
  if (llmConfigured()) {
    try {
      return await llmDecide(odds, reference);
    } catch (e) {
      console.warn("[strategy] LLM failed, using heuristic:", e instanceof Error ? e.message : e);
    }
  }
  return heuristicDecide(odds, reference);
}

// Value heuristic. Implied P(YES) = no/(yes+no) per the CPMM convention. Use
// Polymarket as the fair-value benchmark when available, otherwise a neutral
// 50/50 prior. Execution still happens only against the Miden pool.
export function heuristicDecide(odds: MarketOdds, reference: PolymarketReference | null = null): Decision {
  if (odds.resolution !== 0n) return null; // resolved → no trading
  const total = odds.yes + odds.no;
  if (total === 0n) return null;

  const yesProbBps = Number((odds.no * 10000n) / total); // basis points (0..10000)
  const fairYesBps = reference && reference.active && !reference.closed
    ? Math.round(reference.yesPrice * 10_000)
    : 5000;
  const edgeBps = fairYesBps - yesProbBps;
  const conviction = Math.min(Math.abs(edgeBps) / 100, 20); // percentage points, 0..20
  if (conviction < 2) return null; // no edge → skip

  const size = BigInt(Math.round(conviction)) * 50n; // 100..1000 OBX
  const benchmark = reference ? ` vs Polymarket ${(fairYesBps / 100).toFixed(1)}%` : " vs 50.0% prior";
  return edgeBps > 0
    ? { side: "yes", size, reason: `YES underpriced @ ${(yesProbBps / 100).toFixed(1)}%${benchmark}` }
    : { side: "no", size, reason: `NO underpriced @ ${(100 - yesProbBps / 100).toFixed(1)}%${benchmark}` };
}
