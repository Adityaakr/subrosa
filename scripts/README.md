# scripts/ — transaction scripts + lifecycle driver

Each subdirectory is a Miden **transaction script** (Rust SDK → MASM via
`cargo miden build`) that calls the market account's procedures via generated WIT
bindings:

- `place_yes` / `place_no` — `market.place(side, amount)`
- `resolve_yes` — `market.resolve(1)` (optimistic resolver)
- `redeem_yes` / `redeem_no` — `market.redeem(outcome, shares)` (winner passes,
  loser aborts)

`lifecycle.sh <market_hex>` drives the full flow (open → place YES & NO → resolve
→ redeem winner → redeem loser-aborts) via `client/run_script`, retrying on
transient RPC errors.

> Note: a transaction script embeds the called procedure's MAST root, so rebuild
> the scripts whenever the market contract changes.
