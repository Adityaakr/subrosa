# agent/ — Subrosa confidential trading agent

An AI agent that compares the Miden pool with a validated Polymarket reference.
It runs read-only by default. The verified execution path is currently the web
wallet's collateralized public note plus `market-operator` consumption.

```
read public odds → decide (private brain) → route by size:
  size <= CAP  → autonomous private trade   (agent acts alone)
  size >  CAP  → Guardian co-sign required   (agent proposes, human approves)
```

## Files
- `src/config.ts` — market/faucet ids, `AUTONOMOUS_CAP`, Guardian endpoint, RPC.
- `src/strategy.ts` — the off-chain "brain" (trivial value strategy; swap in real logic).
- `src/onchain.ts` — reads live public odds + places sub-cap trades via the proven
  `miden-client` / `run_script` path (Phase 2).
- `src/polymarket.ts` — reads and validates the configured public Gamma market;
  it never signs or submits a Polygon order.
- `src/guardian.ts` — above-cap co-sign via `@openzeppelin/miden-multisig-client`.
- `src/agent.ts` — the autonomous decision loop (scheduler + safety rails).
- `src/status.ts` — writes `.agent-status.json` each tick (observability).
- `docker/guardian-compose.yml` — self-host the Guardian server.

## Run
```bash
npm install
npm run typecheck

# single read-only decision tick:
npm start -- --once

# continuous read-only loop (reads odds and decides every 5 min):
npm start

# safe to run anywhere — decides + logs but never submits a tx:
SUBROSA_DRY_RUN=1 npm start
```
Watch it live: `tail -f .agent-status.json`. Stop a running loop without
killing the process: `touch .agent-stop` (delete it to allow a restart).

### Safety rails (env, all optional)
A hands-off agent on testnet needs hard stops. Defaults are conservative:

| Env | Default | Effect |
|-----|---------|--------|
| `SUBROSA_POLL_MS` | `300000` (5 min, 60s floor) | loop cadence; ticks never overlap |
| `SUBROSA_AGENT_ENABLED` | `0` | `1` enables the legacy direct-script path; keep off for the note-based market |
| `SUBROSA_DRY_RUN` | `0` | `1` = decide + log, never submit a tx |
| `SUBROSA_MAX_TRADES` | `20` | end the session after N placed trades |
| `SUBROSA_BUDGET_OBX` | `5000` | end the session once cumulative staked OBX would exceed this |
| `SUBROSA_BACKOFF_MS` | `300000` | error backoff ceiling (exponential on consecutive errors) |
| `SUBROSA_CAP` | `500` | autonomous size cap; above it → human co-sign |
| `POLYMARKET_SLUG` | Morocco World Cup market | public price/resolution reference; empty disables it |
| `POLYMARKET_GAMMA_URL` | `https://gamma-api.polymarket.com` | Gamma API endpoint |
| `POLYMARKET_CONDITION_ID` | configured mirror condition | prevents slug remapping during resolution |
| `SUBROSA_PLACE_NOTE_ROOTS` | compiled YES/NO roots | comma-separated allowlist consumed by the market operator |
| `SUBROSA_RESOLUTION_ENABLED` | unset | must be `1` before the irreversible resolution relay submits |

The loop also stands down automatically when the market resolves.

> full guardrail (above-cap co-sign) needs a self-hosted Guardian + a human
> co-signer — in the dapp this surfaces under **Approvals**. See ../docs/GUARDIAN.md

## Guardrail design
Miden multisig has no native *size*-conditional threshold, so the cap is enforced
app-side with a two-account model (1-of-1 agent account ≤ cap; 2-of-N agent+human
Guardian multisig > cap). Full rationale: `../docs/GUARDIAN.md`, `../docs/DECISIONS.md` (D-015).

> Status: the decision loop runs against live on-chain odds and Polymarket with
> an OpenRouter brain (heuristic fallback). Live note execution is verified via
> the web wallet and market operator; direct autonomous submission is disabled.
