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
- peer: `@miden-sdk/miden-sdk` — the multisig client bundles **no WASM of its own**
  and depends on the app's copy. The dapp pins **one** version with an `overrides`
  block in `web/app/package.json` (`"@miden-sdk/miden-sdk": "0.14.11"`); a second,
  nested copy causes a WASM `LinkError` (`Import #294 "memory"`) at runtime.

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

## Browser path — protected bets (`web/app/src/cosign.ts`)
The dapp performs the **same** propose → sign(agent) → sign(human) → execute
ceremony **live in the browser** when a user places a *protected* bet. Each user
gets their own cached 2-of-N Guardian betting account. Two things were required to
make 2-of-2 actually reach threshold on-chain:

1. **Distinct cosigner keys.** `AuthSecretKey.rpoFalconWithRNG(null)` seeds from a
   default and returns the **same** key every call. Seed both signers from a CSPRNG
   (`rpoFalconWithRNG(randSeed())`) so the agent and human commitments differ.
2. **A separate `MultisigClient` per cosigner.** `load(account, signer)` calls
   `guardianClient.setSigner(signer)` on a **shared** client, and the returned
   `Multisig` keeps that client — so loading both signers on one client made
   Guardian attribute both signatures to whichever loaded last (`409
   proposal_already_signed`, stuck at "1 of 2"). Give the agent and human their own
   `MultisigClient` (`clientA` / `clientH`) so their Guardian auth is independent.

A self-heal check plus an identity-version bump (`subrosa.guardian.identity.vN` in
localStorage) abandons any account created by an earlier broken build.

## Status / what's verified
- ✅ Design + API grounded in the repo; `agent/` and `web/app/src/cosign.ts` written
  to the verified surface.
- ✅ End-to-end browser co-sign exercised live: create/register 2-of-N → collect
  both signatures → `executeProposal` submits on-chain (per-cosigner-client fix,
  commit `b45d8ec`).
- ✅ `FalconSigner` / `AuthSecretKey.rpoFalconWithRNG(seed)` confirmed — **must** be
  given a CSPRNG seed (a `null`/`undefined` seed returns identical keys).
- Guardian is WIP; keep the dependency thin and re-verify on SDK bumps.

## Backup/recovery (optional, secondary)
`@openzeppelin/guardian-client` `GuardianHttpClient`: `configure(...)` /
`pushDelta(...)` / `getState(id)` / `getDelta(id, nonce)` / `lookupAccountByKeyCommitment(...)`
— lets a trader recover a private account (and its positions / redeem rights)
after losing a device. Self-hosted, same privacy boundary.
