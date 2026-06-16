# Guardian integration — confidential agent co-sign

Subrosa uses [OpenZeppelin Guardian](https://github.com/OpenZeppelin/guardian) to
coordinate the confidential agent's **human co-sign above a size cap**, and
(optionally) to back up/recover private accounts. Verified against the repo @ main.

## Why, and the privacy boundary
Guardian is **non-custodial** — it coordinates and acknowledges state changes but
never holds a spending key, so it cannot move funds. But it **does store the
state/delta payloads it receives**, so a third-party operator could observe
positions. For a privacy product that's unacceptable, so **we self-host Guardian**
(it's a resilience/coordination layer for us, not a privacy layer). See
`docs/DECISIONS.md` D-014.

## The guardrail design (D-015)
Miden multisig has **no native size-conditional threshold** — the on-chain k-of-n
threshold is uniform (or per-procedure-root, not per-amount). So
"autonomous ≤ cap / co-sign > cap" is enforced **app-side** with two accounts:

| Account | Auth | Used for |
|---|---|---|
| Agent account | 1-of-1 (agent key) | autonomous trades **≤ `AUTONOMOUS_CAP`** |
| Multisig account | 2-of-N (agent + human) + Guardian ack | trades **> cap** — agent proposes, human co-signs |

## Packages (verified)
- `@openzeppelin/miden-multisig-client@^0.14.9` — multisig + proposal/co-sign SDK
- `@openzeppelin/guardian-client@^0.14.9` — lower-level HTTP client (backup/recovery)
- peer: `@miden-sdk/miden-sdk@0.14.5` (exact pin the multisig client requires —
  do **not** float to 0.15.x)

## Run it — real on-chain co-sign in 3 commands
```bash
# 1. self-host Guardian (non-custodial coordinator)
git clone https://github.com/OpenZeppelin/guardian ../guardian
cd agent && npm install
GUARDIAN_REPO=../guardian npm run guardian:up        # → :3000 / :50051
curl http://localhost:3000/pubkey                    # guardian commitment (liveness)

# 2. ONE-COMMAND co-sign demo → a REAL on-chain multisig tx
#    Creates a 2-of-2 (agent+human) Guardian multisig, proposes a trade,
#    signs with BOTH local signers (you play both parties), and executes.
npm run cosign
#    → prints the multisig account id + "EXECUTED on-chain" — verify the
#      account/tx on https://testnet.midenscan.com

# 3. (optional) run the autonomous agent loop with the cap guardrail
export SUBROSA_MULTISIG=0x<id printed in step 2>
npm start                              # or: npm start -- --once
```
`npm run cosign` (`src/cosign-demo.ts`) is the fastest path to a real Guardian
co-sign hash. The agent loop (`npm start`) routes sub-cap trades to the
autonomous path and above-cap trades to this same propose→co-sign→execute flow.

## Co-sign flow (verified API)
`createP2idProposal(recipient, faucet, amount)` → agent `signProposal(id)` →
human `syncProposals()` + `signProposal(id)` on their device → once `status==='ready'`,
`executeProposal(id)` combines signatures + the Guardian ack and submits on-chain.

## Status / what's verified
- ✅ Design + API grounded in the repo; `agent/` written to the verified surface.
- ⚠️ End-to-end (live Guardian server + a human co-signer + on-chain finalize) is
  not yet exercised here — it needs the docker server up and a second signer.
- ⚠️ `FalconSigner` / `AuthSecretKey.rpoFalconWithRNG(...)` exact constructor is
  UNVERIFIED (from the repo sketch) — confirm at first run.
- Guardian is WIP; keep the dependency thin and re-verify on SDK bumps.

## Backup/recovery (optional, secondary)
`@openzeppelin/guardian-client` `GuardianHttpClient`: `configure(...)` /
`pushDelta(...)` / `getState(id)` / `getDelta(id, nonce)` / `lookupAccountByKeyCommitment(...)`
— lets a trader recover a private account (and its positions / redeem rights)
after losing a device. Self-hosted, same privacy boundary.
