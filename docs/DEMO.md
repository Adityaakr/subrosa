# Subrosa — demo & verification checklist

Everything below is live on **Miden testnet**. Public artifacts show full data on
the explorer; private ones show **only a commitment** — that's the whole point.

> Explorer: https://testnet.midenscan.com

## Accounts
| Role | Account | Visibility |
|---|---|---|
| OBX collateral faucet | `0x1201d9f8819d5220778535e4e2f08a` | public (full state) |
| Market pool (market + wallet) | `0x1431d83c1acd72107eeb2816ff0924` | public (reserves visible) |
| Trader | `0xbe087c335e4431903f27774ffa7a84` | **private (commitment only)** |
| Winner (paid 250 OBX) | `0x0e505b3455f637905f71e52f041645` | **private (commitment only)** |

## Key transactions (all committed)
| Action | Tx |
|---|---|
| place YES 250 | `0x1944a2837b90a75a05318a615439cfde4176d35027177a50bd46069c62a93614` |
| place NO 100 | `0xf7ab5690cc7ded7eaf15cb8a6ef1bbd0f5da00e3f955e54b8bb6886e0958cb8b` |
| resolve YES | `0xf1f5ee8caee853d6fcbe328580bf5e9f6a0ec3efca0d57f9491fbdce497d058a` |
| redeem YES (winner) | `0x1eb19f2f3f3c50f464b96578f3475bce8b1931379ce00b7790ac7d0ea096b0ef` |
| private payout note | `0x4c745d37b7287695f74692b04a61e9f2a3c8bc2cde73312a385eca5f3795544c` |

## Prove privacy yourself
```bash
cd client
cargo run --bin verify_privacy \
  "market pool=0x1431d83c1acd72107eeb2816ff0924" \
  "winner=0x0e505b3455f637905f71e52f041645"
# market pool -> FULL public state ; winner -> COMMITMENT ONLY
```

## Run the full market lifecycle
```bash
bash scripts/lifecycle.sh <market_account_hex>
# open -> place YES & NO -> resolve -> redeem winner -> redeem loser (aborts)
```
