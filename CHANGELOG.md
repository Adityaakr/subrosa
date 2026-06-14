# Changelog

All notable milestones for Subrosa (private prediction markets on Miden).
Pre-mainnet research build; everything runs on Miden **testnet**.

## Phase 2 — real market
- Custom `Market` account: public reserves + `place`, optimistic `resolve`, and a
  `redeem` redemption guard (winner redeems, loser aborts) — verified on testnet.
- Real private payout: pool (market + wallet) pays the winner via a private P2ID
  note; node shows the winner as commitment-only.

## Phase 1 — the magic moment
- Custom market account (Rust SDK → MASM) deployed public; `place` moves public
  odds on-chain via a custom transaction script.
- Private position proven: node `GetAccountDetails` returns only a commitment for
  the private account (`client/verify_privacy`).

## Phase 0 — environment
- Toolchain pinned (midenup 0.2.0 / client 0.14.9 to match the node), monorepo
  scaffolded, Miden model documented; first transaction committed on testnet.
