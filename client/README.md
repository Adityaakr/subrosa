# client/ — Rust client binaries

Built against `miden-client = 0.14.9` (matches the live testnet node; see
`docs/VERSIONS.md`). Standard `cargo build`.

- **`verify_privacy`** — queries the node's `GetAccountDetails` for accounts and
  reports public (full state) vs private (commitment only). The privacy proof.
  ```bash
  cargo run --bin verify_privacy "label=0xACCOUNT" ...
  ```
- **`place_position`** — loads a compiled tx-script (`.masp`), submits a
  custom-script transaction (local prover) against the market.
- **`run_script`** — generic: `run_script <account_hex> <script.masp>` — submits
  any compiled transaction script against an account. Drives place/resolve/redeem.

Reuses the CLI-created store/keystore under `.miden/` (gitignored).
