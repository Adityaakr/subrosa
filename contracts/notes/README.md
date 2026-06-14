# contracts/notes/ — position & redemption note scripts (planned)

Private YES/NO **position notes** delivered into a trader's private account, plus
the **redemption guard** that pays out only winning positions.

Current state: the redemption *rule* is enforced on-chain by the market's
`redeem(outcome, shares)` procedure (asserts the market is resolved and the
outcome won; losing/early redeems abort) — see `contracts/market/`. The real
private payout is delivered as a private P2ID note from the pool (proven in the
Phase-2 fast-follow; see `docs/PROGRESS.md`).

Planned here: a self-contained `#[note]` position-note script that carries the
outcome and, when redeemed, emits the pool payout as a private note in one atomic
transaction (host-built recipient via advice inputs — see `docs/DECISIONS.md`
D-013).
