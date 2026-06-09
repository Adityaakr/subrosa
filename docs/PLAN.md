# Obscura — Build Plan

> Private prediction markets with confidential AI agents, on Miden.
> **Tagline:** Bet without being watched. Public odds, private positions.

This is the working plan derived from the build spec. It tracks the phased
roadmap, the current status, and what is blocked on the human. Source of truth
for *what to build* is the spec; source of truth for *Miden APIs* is
[`NOTES_MIDEN.md`](./NOTES_MIDEN.md) + the live docs (see [`VERSIONS.md`](./VERSIONS.md)).

---

## Operating rules (non-negotiable, from the spec)

1. **Verify every Miden API before use.** Miden is pre-mainnet; snippets in the
   spec are illustrative pseudocode. Implement against the real, current API
   (docs.rs for the Rust client, `miden-docs` raw markdown for concepts).
2. **Pin versions** in [`VERSIONS.md`](./VERSIONS.md); don't silently upgrade.
3. **Phase by phase.** Don't start a phase until the previous phase's
   Definition of Done (DoD) passes with captured evidence in
   [`PROGRESS.md`](./PROGRESS.md).
4. **Privacy is the product — prove it.** After any private flow, verify on the
   explorer/node that only a *commitment* is visible (no owner/side/size).
5. **Ask the human** for: testnet access, faucet funds, secrets/keys, oracle
   creds, or product-behavior ambiguity. Never hardcode secrets.
6. **Smallest correct implementation.** The Phase-1 magic moment outranks every
   later feature. No scope creep.

---

## Architecture (target)

```
Client layer
  web/landing/   ✅ marketing site (built) — Miden light-first design language
  web/           ☐ Next.js app + Miden web client (WASM), in-browser proving
  agent/         ☐ confidential agent runner (Polybaskets strategy logic)

Protocol layer (on Miden)
  contracts/market/  ☐ market = PUBLIC (network) account: collateral + CPMM odds
  contracts/notes/   ☐ position notes = PRIVATE YES/NO shares; redemption guard
  capital layer      ☐ Cusp-style LP backstop (v2)
  oracle/resolver    ☐ optimistic resolver (default) or Pragma (upgrade)

Miden base
  client-side execution · STARK proofs · network stores only commitments
```

Component → Miden primitive map lives in [`NOTES_MIDEN.md`](./NOTES_MIDEN.md) §7.

---

## Phase roadmap & status

| Phase | Goal | Status |
|---|---|---|
| **0** | Environment & "hello world" | ✅ Complete — deploy tx committed @ block 1636241 on testnet |
| **1** | ★ Magic moment: public odds move on-chain + private position is commitment-only | ✅ Demonstrated on testnet (see PROGRESS) |
| **2** | Real market: reserves/odds · resolve · redemption guard | ✅ Demonstrated on testnet (market v3; winner redeems, loser aborts) |
| **3** | Web client: browser proving + minimal UI | ☐ |
| **4** | Confidential agent + programmable-auth guardrails | ☐ |
| **5** | Capital layer (Cusp), polish, demo + tutorial | ☐ |

### Phase 0 — Environment & "hello world"  ✅ COMPLETE
**DoD:** a transaction you initiated is visible on testnet explorer; you can
explain accounts/notes/tx lifecycle in `NOTES_MIDEN.md`.  → **MET.**

- [x] Toolchain installed; versions pinned → `VERSIONS.md`
      (`midenup` 0.2.0, active toolchain `0.14.0`, `miden --version` works).
- [x] Repo scaffolded (monorepo per spec §4); landing page relocated to `web/landing/`.
- [x] `NOTES_MIDEN.md` written (verified Miden model summary).
- [x] Client configured for testnet (`miden-client init --local --network testnet`).
- [x] Testnet connectivity confirmed (`sync` → block ~1636225).
- [x] One example tx end-to-end: created + **deployed** a wallet; the deploy
      authentication tx **committed @ block 1636241**, visible on
      `testnet.midenscan.com`. No external faucet needed (deploy is feeless).

> Evidence (tx hash, account id, explorer links) in `PROGRESS.md`.
> Faucet/collateral is now a **Phase-1** task (create our own fungible faucet via
> `basic-fungible-faucet.masp`), not a blocker.

### Phase 1 — The magic moment  ★ highest priority
- [ ] Create a **private account** for a test trader.
- [ ] Deploy a **minimal binary market** (network account) with trivial CPMM odds
      and a `mint(side, amount)` procedure.
- [ ] Implement the YES/NO position note delivered into the trader's private account.
- [ ] Place a YES position end-to-end, proving client-side.
- [ ] **Verify privacy:** explorer shows pool changed + a new commitment, with
      **no owner / side / size**. Capture tx hash + explorer link.

### Phase 2 — Real market
- [ ] CPMM pricing with live odds from reserves (fixed-point ints, no floats in-VM).
- [ ] Both outcomes / multiple positions.
- [ ] Resolution: optimistic resolver (default); Pragma if testnet feed available.
- [ ] Settlement & private redemption of winners; losing notes expire.
- DoD: full lifecycle integration test passes; odds update with trades.

### Phase 3 — Web client
- [ ] Miden web client (WASM) → in-browser proving.
- [ ] Next.js UI: markets list, detail w/ public odds, bet panel, "your positions"
      (holder-only, PRIVATE badge). Reuse the `web/landing/` design language.
- DoD: connect → see odds → place private position (proved locally) → view own
  position; explorer still shows only a commitment.

### Phase 4 — Confidential agent
- [ ] Private agent account.
- [ ] Decision loop: read public odds + signals → decide → build/prove/submit private tx.
- [ ] Programmable-auth guardrails: autonomous ≤ cap; human co-sign above.
- DoD: agent trades within cap; larger trade triggers co-sign; strategy not
  reconstructable on-chain.

### Phase 5 — Capital layer + polish
- [ ] Cusp-style LP: deposit collateral, track LP shares, route fees.
- [ ] UI polish; realistic content.
- [ ] Tutorial + 2-min demo recording (the DevRel artifact).

---

## Immediate next actions

1. **Human:** confirm testnet RPC endpoint + authorize faucet mint (see open questions).
2. Run `miden client init --network testnet` and `miden client sync` (record in PROGRESS).
3. `miden client new-wallet` → create trader account; `miden client account` to list.
4. `miden mint --target-account <ID> --amount <N>` → faucet; `miden client sync`.
5. Confirm the tx on `testnet.midenscan.com` → Phase 0 DoD met. Then start Phase 1.

---

## Open questions for the human

Defaults were taken ("do what's best"); change any of these any time:
- **Testnet RPC:** ✅ using `https://rpc.testnet.miden.io` (the `--network testnet`
  default; verified working). Will re-check `status.testnet.miden.io` if it fails.
- **Faucet:** ✅ Phase-0 needed no faucet (account deploy is feeless). For Phase 1
  we'll mint test-collateral from **our own** fungible faucet (testnet only).
- **Toolchain pin:** ✅ staying on `midenup`-managed `0.14.0` (verified end-to-end).
- **Codename:** ✅ keeping "Obscura" unless you say otherwise.
- **Oracle (Phase 2):** defaulting to the optimistic resolver (no external
  dependency); Pragma is an upgrade. Flag if you want Pragma wired earlier.

---

## Decision log & evidence

- Design choices + rationale → [`DECISIONS.md`](./DECISIONS.md)
- Phase status + tx hashes / explorer links / test output → [`PROGRESS.md`](./PROGRESS.md)
- Pinned versions → [`VERSIONS.md`](./VERSIONS.md)
- Verified Miden model + real client API → [`NOTES_MIDEN.md`](./NOTES_MIDEN.md)
