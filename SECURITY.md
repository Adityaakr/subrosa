# Security

This is a **pre-mainnet research build on Miden testnet**. No real funds are
involved; the collateral token (OBX) is a test token minted from a faucet in this
repo's control.

- **No secrets in the repo.** Private keys and local state live under `.miden/`
  (keystore, sqlite store) and are gitignored. Never commit that directory.
- **Privacy claims are verified, not assumed.** After private flows we query the
  node to confirm only a commitment is exposed (`client/src/bin/verify_privacy.rs`).
- **Threat model:** assume the node operator and all observers are honest-but-
  curious and see every commitment, the public pool, and timing. The guarantee is
  that they cannot attribute a position to a holder or reconstruct an agent's book.
- **Known limitation (v1):** identity privacy only. Per-trade amounts can leak via
  public AMM reserve deltas; flow/amount privacy (batched clearing) is future work.

Found something? Open an issue — but remember this is testnet, not production.
