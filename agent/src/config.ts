// Subrosa confidential agent — configuration.
//
// Guardrail model (verified design, see docs/DECISIONS.md D-015):
// Miden multisig has NO native size-conditional threshold, so the cap is
// enforced APP-SIDE with two accounts:
//   - AGENT_ACCOUNT  : 1-of-1 private account → autonomous trades up to CAP.
//   - MULTISIG_ACCOUNT: 2-of-N (agent + human) Guardian multisig → above CAP,
//     the agent proposes and a human co-signs via Guardian before it executes.

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

// Loop cadence (ms).
export const POLL_INTERVAL_MS = Number(process.env.SUBROSA_POLL_MS ?? "15000");
