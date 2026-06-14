# tests/ — unit & integration tests (in progress)

Planned coverage (per the build spec §11):

**Unit**
- CPMM math: odds, price impact, conservation, fixed-point precision (golden values).
- Redemption guard: winning note redeems; losing/invalid aborts.
- Auth thresholds: trade ≤ cap proceeds; trade > cap requires co-sign (Phase 4).

**Integration (testnet)**
- Full lifecycle: open → place YES & NO → resolve → redeem winners (private) →
  losers blocked. Currently exercised end-to-end via `scripts/lifecycle.sh`.

**Privacy verification (mandatory)**
- After a private position, assert the node exposes only a commitment — no
  holder/side/size. Implemented in `client/src/bin/verify_privacy.rs`.
