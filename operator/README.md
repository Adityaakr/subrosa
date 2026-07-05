# Subrosa operator

This directory owns the local Miden client state used to deploy and operate
public market accounts. `.miden/` contains private authentication material and
is intentionally ignored.

```bash
miden-client init --local --network testnet
miden-client new-account --account-type public \
  --packages ../contracts/market/target/miden/release/market.masp \
  --init-storage-data-path market-init.toml --deploy
```

The resulting account ID is configured in the web app and agent. Back up the
operator's `.miden` directory securely before accepting non-test collateral.

Run `cd ../agent && npm run market-operator` to consume only the allowlisted
Subrosa YES/NO note-script roots. Unrelated P2ID notes sharing the account tag
are ignored.
