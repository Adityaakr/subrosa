// The agent's private "brain": an OpenRouter LLM reasons over the live public
// odds and returns a trade decision. This runs off-chain and private — only the
// resulting commitment ever touches the chain.
import { OPENROUTER_API_KEY, OPENROUTER_MODEL, MARKET_QUESTION, AUTONOMOUS_CAP } from "./config.js";
import type { MarketOdds } from "./onchain.js";
import type { Decision } from "./strategy.js";

export function llmConfigured(): boolean {
  return OPENROUTER_API_KEY.length > 0;
}

export async function llmDecide(odds: MarketOdds): Promise<Decision> {
  const total = odds.yes + odds.no;
  if (odds.resolution !== 0n || total === 0n) return null;
  const yesProbPct = Number((odds.no * 10000n) / total) / 100; // P(YES)=no/(yes+no)

  const sys =
    "You are a disciplined prediction-market trading agent. Given a market's question and its " +
    "current on-chain implied odds, decide whether to buy YES, buy NO, or HOLD. Only trade when " +
    "you see genuine edge vs the implied probability. Respond ONLY with strict JSON: " +
    `{"action":"yes"|"no"|"hold","sizeObx":<integer 0-${AUTONOMOUS_CAP * 4n}>,"reason":"<short>"}. ` +
    "sizeObx scales with conviction; 0 for hold.";
  const user =
    `Market: "${MARKET_QUESTION}"\n` +
    `Implied P(YES) = ${yesProbPct.toFixed(1)}%  (reserves yes=${odds.yes} no=${odds.no})\n` +
    `Autonomous cap = ${AUTONOMOUS_CAP} OBX (trades above it need human co-sign).\n` +
    "Decide.";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://subrosa.markets",
      "X-Title": "Subrosa Agent",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j: any = await res.json();
  const content = j?.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content);
  const action = String(parsed.action || "hold").toLowerCase();
  if (action !== "yes" && action !== "no") return null;
  const size = BigInt(Math.max(0, Math.round(Number(parsed.sizeObx) || 0)));
  if (size <= 0n) return null;
  return { side: action, size, reason: `LLM: ${String(parsed.reason || "").slice(0, 120)}` };
}
