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

## Connected loop: browser bet → operator → live odds (real, on-chain)
The web app places a PRIVATE position (proved in-browser, commitment-only). You
then run the **operator step** to settle the public odds on-chain:
```bash
scripts/operator.sh yes        # or: no    (MARKET=0x... to target another market)
```
Verified on-chain on the market the web app reads (`0x5ff0303f…480b`):
| step | tx | effect |
|---|---|---|
| place YES 250 | `0x3e4c0c6e7278d6114bc397832af673d281576c61db9707d959e5b3fbccc4ebe2` | `yes_reserve` 1000 → 1250, vol → 250 |
| place NO 100 | `0xf2a45615fcffe12dd4dce76701abb1b6680098ec598e518e948d82dce0d1c69a` | `no_reserve` 1000 → 1100, vol → 350 |

Refresh the web app → the **live odds bar reflects the new reserves**. The
position stays private (trader account = commitment only); the pool/odds are public.

## Guardian co-sign (real on-chain multisig)
Stand up self-hosted Guardian and run one command (see [`GUARDIAN.md`](./GUARDIAN.md)):
```bash
git clone https://github.com/OpenZeppelin/guardian ../guardian
cd agent && npm install
GUARDIAN_REPO=../guardian npm run guardian:up      # → :3000
npm run cosign                                     # 2-of-2 propose → co-sign → execute
```
→ a real Guardian-coordinated multisig transaction, verifiable on the explorer.

---

## 90-second demo script

A spoken walkthrough. Every step is real and verifiable.

1. **The pitch (10s).** "On every public chain, your bets are visible — who,
   which side, how much. Subrosa keeps odds public but positions private, on
   Miden." Show the landing page (`web/landing/index.html`).

2. **Public market (15s).** Open the market account on the explorer
   (`/account/0x1431d83c…`). "The reserves and odds are public — that's what
   makes prices trustworthy." Point at `yes_reserve` / `no_reserve` in storage.

3. **A private position, proved in the browser (25s).** In the web app
   (`cd web/app && npm run dev`), open the LIVE market, pick a side + amount,
   click **Place private position**. Narrate the **"Proving in browser…"** state:
   "My machine proves the transaction — keys and state never leave the device."
   The **privacy seal** appears: *only a commitment is recorded.*

4. **Prove it's actually private (20s).** Run the node query — the punchline:
   ```bash
   cd client && cargo run --bin verify_privacy \
     "market=0x1431d83c1acd72107eeb2816ff0924" \
     "trader=0x0e505b3455f637905f71e52f041645"
   ```
   "The market is fully public. The trader who holds 250 OBX? The node returns
   **commitment only** — no balance, no side, no holder. The position is real,
   but invisible."

5. **Settlement (15s).** "Resolve the market, and only the winning side can
   redeem." Show `scripts/lifecycle.sh` output: redeem YES succeeds, redeem NO
   **aborts** — the loser's transaction fails client-side, never reaching the
   network.

6. **Punchline (5s).** "Public odds, private positions, confidential agents — a
   market structure public chains can't ship."

## What to show as proof (no trust required)
- **Public, full detail:** market + faucet accounts, every tx hash above — all on
  `testnet.midenscan.com`.
- **Private, commitment only:** the trader/winner accounts — the explorer and the
  node expose nothing but a hash.
- **The loser-aborts assertion:** re-run `redeem_no` → `FailedAssertion`.

The build story behind this demo: [`TUTORIAL.md`](./TUTORIAL.md).
