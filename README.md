# Subrosa

**Private prediction markets with confidential AI agents, on Miden.**
Public, trustworthy odds — but your position, size, and P&L stay private. The
network records only a commitment.

> Subrosa is a placeholder codename on Miden. Pre-mainnet; APIs verified against
> live docs, not assumed.

## Repository layout

```
subrosa/
├── docs/            planning + tracking (start here)
│   ├── PLAN.md         roadmap, phase status, open questions  ← read first
│   ├── VERSIONS.md     pinned toolchain & crate versions
│   ├── NOTES_MIDEN.md  verified Miden model + real client API
│   ├── DECISIONS.md    design choices + rationale
│   └── PROGRESS.md     phase status + DoD evidence (tx hashes, explorer links)
├── contracts/       MASM / account & note logic
│   ├── market/         market account (network/public): collateral + CPMM odds
│   └── notes/          private position notes + redemption guard
├── client/          Rust: account creation, tx build/prove/submit
├── agent/           confidential agent runner (Polybaskets strategy logic)
├── scripts/         deploy_market / place_position / resolve / redeem helpers
├── tests/           unit + integration (lifecycle + privacy assertions)
└── web/
    └── landing/        marketing site (built) — open index.html
```

## Status

**Phase 0 (environment)** in progress — toolchain installed and pinned, repo
scaffolded, Miden model documented. Blocked on faucet test funds to complete the
first testnet transaction. See [`docs/PLAN.md`](./docs/PLAN.md).

## Quick start

```bash
# Miden toolchain (already installed in this environment):
miden --version                       # porcelain 0.2.0, toolchain 0.14.0

# View the marketing landing page:
cd web/landing && python3 -m http.server 8000   # → http://localhost:8000

# Next (needs human: confirm RPC + faucet — see docs/PLAN.md):
miden client init --network testnet
miden client new-wallet
miden client sync
```

## Principles
- Verify every Miden API before use; pin versions; build phase by phase.
- Privacy is the product — prove it on the explorer at every private flow.
- Smallest correct implementation; the Phase-1 magic moment outranks features.
