// Subrosa confidential agent — configuration.
//
// Guardrail model (verified design, see docs/DECISIONS.md D-015):
// Miden multisig has NO native size-conditional threshold, so the cap is
// enforced APP-SIDE with two accounts:
//   - AGENT_ACCOUNT  : 1-of-1 private account → autonomous trades up to CAP.
//   - MULTISIG_ACCOUNT: 2-of-N (agent + human) Guardian multisig → above CAP,
//     the agent proposes and a human co-signs via Guardian before it executes.
import "dotenv/config"; // load agent/.env (OPENROUTER_API_KEY, DATABASE_URL, …)

// OpenRouter — the agent's private "brain". When set, trade decisions come from
// an LLM reasoning over the live public odds; otherwise a heuristic fallback.
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
// Human-readable question for the market the agent trades (context for the LLM).
export const MARKET_QUESTION =
  process.env.SUBROSA_MARKET_QUESTION ?? "Will Morocco win the 2026 FIFA World Cup?";

// Optional Polymarket mirror. This is a public reference/oracle feed; execution
// remains on Miden and the agent never holds a Polygon trading key.
export const POLYMARKET_SLUG =
  process.env.POLYMARKET_SLUG ?? "will-morocco-win-the-2026-fifa-world-cup-464";
export const POLYMARKET_GAMMA_URL =
  process.env.POLYMARKET_GAMMA_URL ?? "https://gamma-api.polymarket.com";
export const POLYMARKET_CONDITION_ID =
  process.env.POLYMARKET_CONDITION_ID ??
  "0x37a6de1b21803e5f3fb1965116218215d79963af4f7e51659696366267a63a03";
export const RESOLUTION_RELAY_ENABLED = process.env.SUBROSA_RESOLUTION_ENABLED === "1";

export const MARKET_ID_HEX =
  process.env.SUBROSA_MARKET ?? "0xabbba77bce4bc6d1795be21b30fa5e";
export const OBX_FAUCET_HEX =
  process.env.SUBROSA_FAUCET ?? "0x1201d9f8819d5220778535e4e2f08a";

// Autonomous size cap (OBX, base units). At/below: agent acts alone.
// Above: requires a human co-signature coordinated by Guardian.
export const AUTONOMOUS_CAP = BigInt(process.env.SUBROSA_CAP ?? "500");

// The agent's own private (1-of-1) account for sub-cap autonomous trades.
// Defaults to the CLI default account if unset.
export const AGENT_ACCOUNT_HEX = process.env.SUBROSA_AGENT_ACCOUNT ?? "";

// Self-hosted Guardian server (docker compose → :3000) and the testnet RPC.
export const GUARDIAN_ENDPOINT =
  process.env.GUARDIAN_ENDPOINT ?? "http://localhost:3000";
export const MIDEN_RPC = process.env.MIDEN_RPC ?? "https://rpc.testnet.miden.io";

// Miden client CLI used for the proven on-chain submit of autonomous trades.
export const MIDEN_CLI =
  process.env.MIDEN_CLI ??
  `${process.env.HOME}/.cargo/bin/miden-client`;

// Storage slot names exported by the market component (public reserves).
export const SLOT_YES = "market::market::yes_reserve";
export const SLOT_NO = "market::market::no_reserve";
export const SLOT_RES = "market::market::resolution";

// Loop cadence (ms). Proving + submitting a place tx takes ~1–2 min and ticks
// never overlap (the next is scheduled only after the current finishes), so the
// floor is 60s to avoid hammering the RPC/CLI; default is a calm 5 min.
export const POLL_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.SUBROSA_POLL_MS ?? "300000"),
);

// ── Autonomous-loop safety rails ──────────────────────────────────────────
// A hands-off agent on testnet needs hard stops so it can't run away.
// Master switch: live autonomous submission is disabled by default. The
// current collateralized market accepts execution notes through the operator;
// the legacy direct transaction scripts must not be used accidentally.
export const AGENT_ENABLED = (process.env.SUBROSA_AGENT_ENABLED ?? "0") === "1";
// Decide + log but never submit a real tx (safe to run anywhere).
export const DRY_RUN = (process.env.SUBROSA_DRY_RUN ?? "0") === "1";
// Session budget: stop after this many placed trades, or once cumulative staked
// OBX would exceed the budget. Both are terminal — the loop ends cleanly.
export const MAX_TRADES = Number(process.env.SUBROSA_MAX_TRADES ?? "20");
export const BUDGET_OBX = BigInt(process.env.SUBROSA_BUDGET_OBX ?? "5000");
// On repeated errors, back off exponentially up to this ceiling (ms).
export const ERROR_BACKOFF_MS = Number(process.env.SUBROSA_BACKOFF_MS ?? "300000");
// Runtime kill switch: if this file exists, the loop halts before its next tick.
// (touch agent/.agent-stop to stop a running agent; rm it to allow restart.)
export const STOP_FILE = ".agent-stop";
// Fixed on-chain stake per side baked into the compiled place_*.masp (v1).
// Used for budget accounting; the LLM's size drives cap routing (intent).
export const STAKE_OBX = { yes: 250n, no: 100n } as const;

// Protocol-0.15 custom place-note script roots. The operator consumes only
// these roots and ignores unrelated P2ID notes that share the market's tag.
export const PLACE_NOTE_ROOTS = new Set(
  (process.env.SUBROSA_PLACE_NOTE_ROOTS ??
    "0xac61f5ee1974cd89501dc3c2a7f5f4ec49f706d823aa91766e86c1e6fa46fa74," +
    "0xdfe21fc70696fe142fe0fc7922d27fe3d2283e72c0bdb304f651813569fc5261")
    .split(",")
    .map((root) => root.trim().toLowerCase())
    .filter(Boolean),
);
