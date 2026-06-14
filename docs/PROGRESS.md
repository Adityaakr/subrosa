# PROGRESS — phase status + DoD evidence

## Phase 0 — Environment  ✅
First tx committed on testnet (explorer-verified). Toolchain pinned to 0.14.9.

## Phase 1 — The magic moment  ✅ DEMONSTRATED
- Custom Market account (Rust SDK → MASM) deployed PUBLIC; place() moves public
  reserves on-chain via a custom transaction script.
- Private position proven: node GetAccountDetails returns COMMITMENT ONLY for the
  private account (client/verify_privacy).

## Phase 2 — Real market  (in progress)
- [x] resolution + optimistic resolve()
- [x] redemption guard: winner redeems, loser aborts
- [ ] real private payout from the pool
