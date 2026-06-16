# DECISIONS — design choices + rationale

Append-only log. Each entry: what we decided, why, and what would change it.

---

### D-001 · Monorepo layout per spec §4; landing page under `web/landing/`
**Decided:** keep the spec's monorepo (`contracts/`, `client/`, `agent/`,
`scripts/`, `tests/`, `web/`) and move the already-built marketing site into
`web/landing/`. Tracking docs live in `docs/` (per request) rather than repo root.
**Why:** keeps the root clean; the landing is static and distinct from the
Next.js app that will live in `web/`. All landing assets are relative, so moving
the folder as a unit doesn't break it.
**Reversible:** yes.

### D-002 · ~~Stay on toolchain `0.14.0`~~ — SUPERSEDED by D-007
**Originally:** target the `midenup`-managed `0.14.0` toolchain.
**Verified working** for init/sync/deploy/mint-submit, but `sync` then broke
against the live testnet node (see D-007). Superseded.

### D-007 · Upgrade the client to `0.15.0` to match the testnet node
**Decided:** install `miden-client-cli` `0.15.0` from crates.io (the `midenup`
manifest only ships the `0.14.0` channel, client `0.14.4`).
**Why:** on `0.14.4`, `miden-client sync` fails with a Protobuf wire-type error
decoding `SyncTransactionsResponse` (`NoteMetadataHeader.sender` / `AccountId.id`:
`invalid wire type: SixtyFourBit (expected LengthDelimited)`). The testnet node
is ahead of the `0.14` client's protobuf schema. Tx *submission* still works
(deploy + mint committed on-chain), but the client can't read transaction sync
records → blocks Phase 1. This is exactly the spec's "API churn / re-check on SDK
bump" risk.
**Consequence:** local `.miden/` store/keystore were created by `0.14`; if `0.15`
won't open them, re-init fresh on `0.15` and recreate faucet + trader + mint
(testnet, cheap). Update `VERSIONS.md` once `0.15` is verified end-to-end.
**What would change it:** node downgrades (won't) or a `0.15` regression forcing a
pinned intermediate. Default forward: track the node.

### D-003 · Optimistic resolver as the default resolution mechanism
**Decided:** Phase 2 resolution = an authorized resolver posts the outcome with a
challenge window; flip to redeemable after it. Pragma is an *upgrade*, not a
dependency.
**Why:** no external testnet dependency → demo is self-contained and reliable.
**What would change it:** a working Pragma testnet feed + human prioritization.

### D-004 · CPMM (constant-product) pricing for v1, fixed-point integers
**Decided:** market odds from reserves via CPMM; `price(YES) = R_no/(R_yes+R_no)`.
All in-VM math is fixed-point integers (no floats). Exact formula + precision +
golden test values to be recorded here when implemented (Phase 2).
**Why:** de-risks in-VM math; LMSR is a fast-follow once notes/accounts work.
**Status:** to implement in Phase 2.

### D-005 · Privacy scope for v1 = identity privacy only (documented limit)
**Decided:** v1 guarantees *who holds what* is private. **Flow/amount privacy**
(per-trade size via AMM reserve deltas) is NOT claimed in v1 — real fix is
batched/dark-pool clearing (v3).
**Why:** honest threat model; a public AMM leaks per-trade size via reserve
deltas. Do not overclaim.

### D-006 · Fonts on the landing served via Google Fonts (not self-hosted)
**Decided:** `web/landing/tokens/fonts.css` loads Space Grotesk / Inter /
JetBrains Mono from Google Fonts; the original self-hosted `@font-face` block is
kept commented for a one-line swap-back.
**Why:** the design system self-hosts woff2 binaries that weren't shipped here;
Google Fonts renders the identical faces without dragging font binaries around.
**Reversible:** yes (drop woff2 into `assets/fonts/`, uncomment).

---

### D-009 · Minimal market = public component with reserves + trivial CPMM
**Decided:** the Phase-1 market is a custom `#[component]` account (miden SDK
0.12) with **public** storage (`yes_reserve`/`no_reserve`/`total_volume` as
`StorageValue<Felt>`) and a `place(side, amount)` procedure that adds to the
chosen reserve (field addition only — no in-field division). Implied odds
(`price(YES)=no/(yes+no)`) are computed **off-chain** for display.
**Why:** keeps in-VM math trivial/safe (spec §9.3, rule 6), makes odds public &
trustworthy while the position stays private, and de-risks the magic moment.
LMSR / on-chain pricing is a Phase-2 fast-follow.
**Build path:** Rust SDK crate → `cargo miden build` → `.masp` → deploy as a
public account via `miden-client new-account -p market.masp`. Verified: deployed
`0xb8512d8a…afd8`, public reserves on-chain.

### D-010 · Toolchain split: `midenup` 0.14 for contracts, client `0.14.9`
**Decided:** build account/note/tx-script crates with the `midenup`-managed
toolchain `0.14.0` (`cargo miden` → `miden` SDK 0.12, nightly-2025-12-10 +
`wasm32-wasip2`); use the standalone CLI/lib `0.14.9` for client ops + the node.
Each new contract crate needs the scaffolder's `rust-toolchain.toml` (nightly pin)
or `cargo miden build` fails with a `-Z`/stable error.
**Why:** the two version lines serve different layers and both verified working.

### D-011 · Resolution + redemption guard live in the market account
**Decided (Phase 2):** the optimistic resolver and the redemption guard are
procedures on the public market account, not (yet) a foreign-account read from a
note script. `resolve(outcome)` is one-shot (asserts unresolved) and authorized
by the market account key (= resolver authority for v1). `redeem(outcome, shares)`
asserts `resolution != 0 && outcome == resolution`, so a losing/early redeem
aborts at execution (client-side, no network state change, no fee).
**Why:** keeps settlement trustless and on-chain without needing FPI / foreign
storage reads inside note scripts (advanced, unverified in SDK 0.12). The
assertion *is* the settlement rule; verified on testnet (winner redeems, loser
aborts with `FailedAssertion`).
**Fast-follow:** carry the position as a real private note and have `redeem` emit
the pool payout as a private note to the winner (`output_note::create` +
`move_asset_to_note`); add on-chain CPMM/LMSR pricing. Architecture proven; this
is asset/note plumbing.

### D-012 · Redeploy (not upgrade) on contract storage/MAST changes
**Decided:** each market revision (v1 reserves → v2 +resolution → v3
+redeem/guard) is a fresh deployed account; tx-scripts are rebuilt because the
called procedure's MAST root changes. Latest market = v3
`0x73e247e45c1e061027c56478d9872a`.
**Why:** adding storage slots changes layout; rebuilding scripts keeps the
embedded procedure roots correct. Account-code upgrade-in-place is possible
(RegularAccountUpdatableCode) but unnecessary for the build.

### D-013 · Payout = host-side P2ID private send from a wallet-composed pool
**Decided:** the market account is composed from the **market component +
`basic-wallet`** (two `-p` packages) so it can hold collateral and emit notes.
Winner payout is a **private P2ID note** sent from the pool (`miden-client send
--note-type private`, the proven mechanism), gated by the on-chain `redeem`
entitlement guard. Verified: pool 1000→750 OBX, winner holds 250 OBX privately
(node returns commitment only).
**Why:** the on-chain `miden` 0.12 SDK has **no** P2ID script-root constant, no
serial-num RNG, and no `NoteType::private()`/`Tag::from_account_id` — those are
host-side (`miden-standards`/`miden-protocol`). So a note created *inside* a
procedure needs the recipient/serial/script-root/tag passed in as inputs. The
host-side P2ID send is the smallest correct way to deliver a real private payout
today (verified facts: PRIVATE note type = felt `2`; P2ID storage =
`[target.suffix, target.prefix]`; `note::build_recipient(serial, script_root,
storage)`; `output_note::create`/`add_asset`; `create_fungible_asset`).
**Next refinement (atomic):** have `redeem` itself `output_note::create` the
payout note using a host-built recipient injected via advice inputs (the
`basic-wallet-tx-script` pattern) so entitlement-check + payout are one tx.

### D-014 · Adopt Guardian (self-hosted) for agent co-sign + recovery
**Decided:** use OpenZeppelin Guardian, **self-hosted**, scoped to two jobs: the
confidential agent's human co-sign above the cap (`@openzeppelin/miden-multisig-client`)
and optional private-account backup/recovery (`@openzeppelin/guardian-client`).
**Why:** the co-sign-above-cap guardrail IS a private threshold-signature
workflow, which Guardian is purpose-built to coordinate; recovery solves the
real "lose device → lose private positions" risk. **Self-hosted** because
Guardian stores the payloads it receives — a third-party operator could observe
positions, which would undercut the privacy claim. Guardian is non-custodial
(coordinates/acks; never holds a key). It's WIP → keep the dependency thin,
verify on bumps. See `docs/GUARDIAN.md`.

### D-015 · Size cap is enforced app-side via a two-account model
**Decided:** "autonomous ≤ cap / human co-sign > cap" is enforced in the agent,
not in the Miden auth: a **1-of-1 agent account** for sub-cap autonomous trades
and a **2-of-N agent+human Guardian multisig** for above-cap trades.
**Why (verified):** Miden multisig has **no native size/amount-conditional
threshold** — the on-chain k-of-n threshold is uniform (or per-procedure-root,
not per-amount). So a value-gated rule cannot live in the auth component; the
clean verified design is two accounts + app-side routing.
**Versions:** pin `@miden-sdk/miden-sdk@0.14.5` (exact peer the multisig client
requires); avoid 0.15.x.

## Pending decisions (need input — see PLAN.md open questions)
- Testnet RPC endpoint (default vs current rotated URL).
- Faucet authorization for test funds.
- Toolchain `0.14.0` vs crate `0.15.0` (D-002).
- Keep codename "Obscura" or rename.
