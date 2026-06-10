# contracts/ — Miden on-chain code

Built with the `midenup`-managed toolchain (`cargo miden build`, miden SDK 0.12,
nightly + `wasm32-wasip2`). See `docs/VERSIONS.md`.

- **`market/`** — the prediction-market **account component**. Public storage:
  `yes_reserve`, `no_reserve`, `total_volume`, `resolution`. Procedures:
  `place(side, amount)`, `resolve(outcome)`, `redeem(outcome, shares)`, and
  getters. Public reserves = trustworthy odds; positions stay private notes.
- **`notes/`** — position & redemption note scripts (planned; see its README).

Deploy a component as a public account:
```bash
cargo miden build
miden-client new-account --account-type regular-account-updatable-code \
  -p market/target/miden/debug/market.masp --storage-mode public --deploy
```
