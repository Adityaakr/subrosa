import type { MarketOdds } from "./onchain.js";
import { llmConfigured, llmDecide } from "./llm.js";

export type Decision = { side: "yes" | "no"; size: bigint; reason: string } | null;

// The agent's decision: when OpenRouter is configured, an LLM reasons over the
// live odds (private, off-chain brain); otherwise the heuristic below. The LLM
// path falls back to the heuristic on any error so the loop never stalls.
export async function decide(odds: MarketOdds): Promise<Decision> {
  if (llmConfigured()) {
    try {
      return await llmDecide(odds);
    } catch (e) {
      console.warn("[strategy] LLM failed, using heuristic:", e instanceof Error ? e.message : e);
    }
  }
  return heuristicDecide(odds);
}

// Trivial value heuristic. Implied P(YES) = no/(yes+no) per the CPMM convention.
// If a side looks underpriced vs a fair 50/50 prior, take it; size scales with
// conviction.
export function heuristicDecide(odds: MarketOdds): Decision {
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
