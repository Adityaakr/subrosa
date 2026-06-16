# agent/ — Subrosa confidential trading agent

An AI agent that trades from its **own private Miden account** — strategy and book
stay confidential — with a **programmable-auth guardrail**: autonomous up to a
size cap, human co-sign above it (coordinated by self-hosted **Guardian**).

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
- `src/guardian.ts` — above-cap co-sign via `@openzeppelin/miden-multisig-client`.
- `src/agent.ts` — the decision loop tying it together.
- `docker/guardian-compose.yml` — self-host the Guardian server.

## Run
```bash
npm install
npm run typecheck

# autonomous path only (sub-cap), reusing the proven on-chain tooling:
npm start -- --once

# full guardrail (above-cap co-sign) needs a self-hosted Guardian + a human
# co-signer — see ../docs/GUARDIAN.md
```

## Guardrail design
Miden multisig has no native *size*-conditional threshold, so the cap is enforced
app-side with a two-account model (1-of-1 agent account ≤ cap; 2-of-N agent+human
Guardian multisig > cap). Full rationale: `../docs/GUARDIAN.md`, `../docs/DECISIONS.md` (D-015).

> Status: the agent core + Guardian integration are written to the verified SDK
> API and typecheck; the live above-cap co-sign (Guardian server + human) is the
> remaining end-to-end step.
