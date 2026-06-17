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
  process.env.SUBROSA_MARKET_QUESTION ?? "Will Miden mainnet launch before Aug 1, 2026?";

export const MARKET_ID_HEX =
  process.env.SUBROSA_MARKET ?? "0x5ff0303f0b795d1039ca5b51d8480b";
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
export const SLOT_YES = "miden_market::market::yes_reserve";
export const SLOT_NO = "miden_market::market::no_reserve";
export const SLOT_RES = "miden_market::market::resolution";

// Loop cadence (ms). Proving + submitting a place tx takes ~1–2 min and ticks
// never overlap (the next is scheduled only after the current finishes), so the
// floor is 60s to avoid hammering the RPC/CLI; default is a calm 5 min.
export const POLL_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.SUBROSA_POLL_MS ?? "300000"),
);

// ── Autonomous-loop safety rails ──────────────────────────────────────────
// A hands-off agent on testnet needs hard stops so it can't run away.
// Master switch: SUBROSA_AGENT_ENABLED=0 starts the agent in read-only mode
// (reads odds + decides, never places). Defaults on.
export const AGENT_ENABLED = (process.env.SUBROSA_AGENT_ENABLED ?? "1") !== "0";
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
