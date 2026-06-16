# PROGRESS — phase status + DoD evidence

> Update per the agent loop: READ → PLAN → SCAFFOLD → IMPLEMENT → TEST →
> VERIFY → RECORD. Capture tx hashes, explorer links, and test output here.

---

## Phase 0 — Environment & "hello world"  ✅ COMPLETE (2026-06-16)

**DoD:** a transaction you initiated is visible on testnet explorer; you can
explain accounts/notes/tx lifecycle in `NOTES_MIDEN.md`.  → **MET.**

| Item | Status | Evidence |
|---|---|---|
| Host toolchain | ✅ | rustc 1.95.0, cargo 1.95.0, node v24.14.1, npm 11.11.0, git 2.50.1 |
| `midenup` installed | ✅ | `cargo install midenup` exit 0; `midenup --version` → 0.2.0 |
| `midenup init` | ✅ | initialized at `~/Library/Application Support/midenup` |
| `miden --version` works | ✅ | porcelain 0.2.0, active toolchain **0.14.0** |
| `miden-client` available | ✅ | toolchain bin `0.14.0`; full subcommand list captured (see NOTES §5) |
| Versions pinned | ✅ | `docs/VERSIONS.md` |
| Repo scaffolded | ✅ | monorepo per spec §4; landing → `web/landing/`; `git init` done |
| `NOTES_MIDEN.md` written | ✅ | `docs/NOTES_MIDEN.md` (verified, cited) |
| Client init for testnet | ✅ | `miden-client init --local --network testnet` → `.miden/miden-client.toml`, RPC `rpc.testnet.miden.io` |
| Testnet connectivity | ✅ | `sync` → block 1636225; `info` → node `rpc.testnet.miden.io` |
| **Transaction on explorer** | ✅ | wallet deploy auth-tx **Committed @ block 1636241** (see below) |

**Phase-0 hello-world evidence:**
- Wallet (public, mutable): `0xf08b25144e50c410397e92cf63f6ae`
  - explorer: https://testnet.midenscan.com/account/0xf08b25144e50c410397e92cf63f6ae (200)
- Deploy (authentication) transaction:
  `0x20482d9effc85655b693c9a08b1e57f377b18224fad7812cd0bab06989c1766e`
  - status: **Committed (Block 1636241)**
  - explorer: https://testnet.midenscan.com/tx/0x20482d9effc85655b693c9a08b1e57f377b18224fad7812cd0bab06989c1766e (200)
- Note: a cosmetic warning `failed to load MASM sources into source manager`
  prints during deploy (missing optional debug-source dir); the tx still
  executed, proved locally, and committed. Tracked, non-blocking.

**Notes / log:**
- 2026-06-16: installed `midenup` 0.2.0, active toolchain `0.14.0`. `miden` ⇒
  `midenup` symlink in `~/.cargo/bin`. `miden --version` verified.
- 2026-06-16: scaffolded monorepo; relocated marketing landing to `web/landing/`
  (renders standalone; assets resolve 200 over `python3 -m http.server`).
- 2026-06-16: wrote `docs/` — PLAN, VERSIONS, NOTES_MIDEN, DECISIONS, PROGRESS.
- 2026-06-16: init testnet (local `.miden/`), synced (block ~1636225), created +
  **deployed** a wallet; deploy tx committed on testnet and visible on explorer.
  No faucet/external funds were needed — account deploy is feeless on testnet.
- Decision confirmed: `0.14.0` toolchain works end-to-end (D-002).

**Defaults taken (per "do what's best"):** testnet default RPC
(`rpc.testnet.miden.io`), `0.14.0` toolchain, codename "Obscura" kept.

---

## Phase 1 — The magic moment  🟡 in progress

### Version blocker found & fixed (D-007 → D-008)
- `0.14.4` (midenup): `sync` broke after a mint — Protobuf wire-type error on
  `SyncTransactionsResponse` (`AccountId.id` `SixtyFourBit` vs `LengthDelimited`).
- `0.15.0`: rejected by the node at the accept-header (`version mismatch`).
- **Resolution:** the node is a **0.14-series** node; installed the latest
  0.14-series CLI **`0.14.9`** (`cargo install miden-client-cli --version 0.14.9
  --locked`). `sync` now works clean before *and after* a mint. Store from 0.14.4
  was incompatible ("Migration hashes mismatch") → re-init'd fresh on 0.14.9.

### Private-asset lifecycle verified end-to-end on testnet (0.14.9)
Substrate for the prediction market, all committed on testnet:

| Artifact | ID | On-chain |
|---|---|---|
| OBX collateral faucet (public) | `0x1201d9f8819d5220778535e4e2f08a` | deploy tx `0x83fc4963…2d34` @ block 1636518 |
| Trader wallet (**private**) | `0xbe087c335e4431903f27774ffa7a84` | private storage mode |
| Mint 250 OBX → trader (**private note**) | note `0x6960e052…1ea3` | mint tx `0xbc34fd2c…6969` @ block 1636523 |
| Trader consumes note | — | consume tx `0xafe85d7f…8ef1` @ block 1636535 |
| Trader balance (local store) | 250.000000 OBX | nonce 1; held client-side |

Explorer (all resolve): `testnet.midenscan.com/tx/0xbc34fd2c5898e8e32e48e3eb75c6d4060217be77b6efe04732ccda5157fe6969`

This proves the core Miden privacy primitives work for Obscura: a **private
account** received + consumed a **private note**; the asset balance lives only in
the local store. The explorer (client-rendered off the node) embeds no balance,
asset, or recipient for the private account/note.

### Privacy assertion — PASSED (queried from the node, not assumed)
`client/src/bin/verify_privacy.rs` (miden-client 0.14.9, `tonic`) calls the node's
`GetAccountDetails` RPC for both accounts:
- OBX faucet (public) → `FetchedAccount::Public` = **full on-chain state**;
  commitment `0x9a8774b2…4398`.
- Trader (private) → `FetchedAccount::Private` = **commitment only**
  `0x8cc01813…97b9` — `account()` is `None`: no vault, no balance, no position.
→ The trader's 250 OBX is **not on-chain**. Run: `cd client && cargo run --bin verify_privacy`.

### Custom market account — built, compiled, DEPLOYED (public) ✅
- `contracts/market/` — `#[component] Market` (miden SDK 0.12): public storage
  `yes_reserve` / `no_reserve` / `total_volume` (`StorageValue<Felt>`) + a
  `place(side, amount)` trivial-CPMM procedure (field-add only; odds derived
  off-chain). Compiled to `market.masp` via `cargo miden build`.
- Deployed as a **public** account `0xb8512d8a8a4de2104378207209afd8`
  (deploy tx committed @ testnet; reserves seeded 1000/1000 = 50/50).
  Public storage on-chain shows `yes_reserve=1000`, `no_reserve=1000` — the
  trustworthy-odds half of the design, verifiable on the node.
- `scripts/place_yes/` — a transaction script (SDK `#[tx_script]`) that calls
  `market.place(YES, 250)` via generated WIT bindings; compiled to
  `place_yes.masp`.

### `place` procedure submitted on-chain — public odds moved ✅
`client/src/bin/place_position.rs` (miden-client 0.14.9 + `miden-client-sqlite-store`)
opens the CLI's store/keystore, loads the compiled `place_yes.masp`
(`Package::read_from_bytes` → `try_into_program` → `TransactionScript::new`),
builds a `custom_script` request, and submits with a **local** prover
(`submit_new_transaction_with_prover`).
- tx `0xc5aa8df19aaa05da793151270c0a5882f1266d115fa871e92e1300f9444e7281`
  (committed; market nonce 1 → 2).
- Public reserves moved on-chain: `yes_reserve` 1000 → **1250**,
  `total_volume` 0 → **250**, `no_reserve` 1000 (unchanged). Implied
  price(YES)=no/(yes+no) shifted 0.500 → 0.444. Verified via `account -s`.
- Run: `cargo build --bin place_position && ./client/target/debug/place_position`.

### Phase-1 magic moment — DEMONSTRATED ✅ (both properties on live testnet)
- **Public odds, trustworthy:** custom `Market` account (Rust→MASM), reserves +
  volume in public storage, moved by an on-chain `place(side, amount)` call.
- **Private positions, commitment-only:** private account + private note;
  node `GetAccountDetails` returns only a commitment (`verify_privacy`).
→ "Public odds. Private positions." shown end-to-end on testnet.

### Polish / fast-follow (optional)
- [ ] Unify into one flow: have `place` ALSO emit a private position note to the
      trader (`output_note::create` + `move_asset_to_note`) so a single tx both
      moves public odds and issues the private position. (Architecture proven;
      this is wiring.)
- [ ] CPMM math + odds display in `client/`; resolution + redemption (Phase 2).

## Phase 2 — Real market (price · resolve · settle)  ✅ DEMONSTRATED on testnet

**DoD:** full lifecycle — open → place YES & NO → resolve → winners redeem →
losers can't; odds update with trades. → **MET** (market v3
`0x73e247e45c1e061027c56478d9872a`).

Contract additions (`contracts/market/`): `resolution` storage (0/1/2),
`resolve(outcome)` (one-shot optimistic resolver, asserts unresolved + valid
outcome), `get_resolution()`, a `place` guard (aborts once resolved), and
`redeem(outcome, shares)` — the **redemption guard**: asserts the market is
resolved AND `outcome == resolution`, else aborts.

Full lifecycle run (`scripts/lifecycle.sh`, via `client/.../run_script`):
| Step | tx | result |
|---|---|---|
| place YES 250 | `0x64b227b6…77b4` | reserves move |
| place NO 100 | `0xf7ab5690…cb8b` | reserves move |
| resolve YES | `0xf1f5ee8c…d058a` | `resolution → 1` on-chain |
| redeem YES (winner) | `0x1eb19f2f…b0ef` | ✅ succeeds |
| redeem NO (loser) | — | ✅ **aborts** (`FailedAssertion`, execution failed, no state change) |

Final public state: `yes_reserve=1250`, `no_reserve=1100`, `total_volume=350`,
`resolution=1`. Odds shifted with each trade (price(YES)=no/(yes+no): 0.500 →
0.444 after YES 250 → 0.468 after NO 100). All reserves/resolution are PUBLIC
(node returns full state); trader positions remain private commitments.

**tx-scripts:** `scripts/{place_yes,place_no,resolve_yes,redeem_yes,redeem_no}`
(Rust SDK → MASM). Transient RPC `h2` errors are retried by `lifecycle.sh`.

### Phase-2 fast-follow — REAL private payout from the pool  ✅ DONE
Market v4 `0x1431d83c1acd72107eeb2816ff0924` = **market component + `basic-wallet`**
(composed via two `-p` packages) so the pool can hold and move collateral.
- Funded pool: minted 1000 OBX → market, market consumed it (tx
  `0x1948ec88…c232`) → pool holds 1000 OBX.
- Resolved YES (tx `0x264d2d16…f4a3`).
- **Payout:** market `send --note-type private` 250 OBX → winner
  `0x0e505b34…1645` (private note `0x7cb2236c…eca0`, tx `0x4c745d37…544c`);
  winner consumed it (tx `0x95d7f3bc…9101`).
- Result: winner holds **250 OBX** (private storage); pool **1000 → 750 OBX**.
- **Privacy (node `GetAccountDetails`):** market pool = FULL public state;
  winner = **COMMITMENT ONLY** (`0xcdf26035…`) — payout + balance invisible
  on-chain. Verified via `verify_privacy "market=..." "winner=..."`.

Architectural note (research-backed): a fully *on-chain* redeem-emits-note needs
host-supplied P2ID recipient/serial/script-root (the on-chain SDK can't synthesize
them), so the payout uses the proven host-side P2ID private-send from the pool,
gated by the on-chain `redeem` entitlement guard. The atomic
redeem-emits-the-note variant (SDK `output_note::create` with host-built
recipient via advice inputs) is documented in DECISIONS D-013 as the next refinement.

Remaining pricing fast-follow: on-chain CPMM/LMSR (odds computed off-chain today).

## Phase 3 — Web client (browser proving + UI)  🟡 built, builds & serves

Scaffolded with `create-miden-app` → **Vite + React 19 + TS** using the official
web SDK on the **0.14 line** that matches the node: `@miden-sdk/miden-sdk`,
`@miden-sdk/react`, `@miden-sdk/vite-plugin` (solves WASM bundling).
(Spec suggested Next.js; the supported WASM path is Vite + the official plugin.)

Built in `web/app/`:
- `providers.tsx` — `MidenProvider` with a **local prover** → accounts/txs proved
  **in-browser** (no wallet extension needed).
- `hooks/useMarket.ts` — reads the deployed market's PUBLIC storage **live** from
  the node: `getAccount → storage().getItem(slot).toU64s()` for
  yes/no/volume/resolution. (Fresh open market `0x5ff0303f…480b`, 50/50.)
- `components/Subrosa.tsx` — markets list, market detail with **live odds bar**,
  bet ticket (YES/NO toggle, amount, payout preview), **"Place private position"**
  (creates a PRIVATE account via `useCreateWallet({storageMode:"private"})` →
  proved in-browser), a **PRIVACY SEAL** ("only a commitment is recorded"), and a
  PRIVATE "your positions" view. Brand-styled (`subrosa.css`).

**Verified here:** `npm install`, `npm run build` (tsc typecheck + vite bundle,
incl. the 14 MB WASM + proving web-worker) and the dev server (HTTP 200) all
succeed.
**Needs a browser to confirm (can't drive headless from CLI):** WASM init, the
live odds fetch, and the in-browser proving click-through. Run:
`cd web/app && npm install && npm run dev` → http://localhost:5173.

**DoD remaining:** confirm the in-browser place-position proving end-to-end in a
browser, and wire the on-chain market `place` call from the local wallet (the
read path + private-account proving are done; the custom-tx submit reuses the
proven `scripts/place_*` pattern).
## Phase 4 — Confidential agent + Guardian co-sign  🟡 built, typechecks

`agent/` (TypeScript) — an agent that trades from a private account with a
programmable-auth guardrail, using self-hosted **OpenZeppelin Guardian** for the
human co-sign above the cap.
- `strategy.ts` — off-chain "brain" (trivial value strategy; pluggable).
- `onchain.ts` — reads live public odds + places **sub-cap** trades via the
  proven `miden-client` / `run_script` path (Phase 2).
- `guardian.ts` — **above-cap** co-sign via `@openzeppelin/miden-multisig-client`
  (createP2idProposal → signProposal → syncProposals → executeProposal), self-hosted Guardian.
- `agent.ts` — decision loop routing by size vs `AUTONOMOUS_CAP`.
- `docker/guardian-compose.yml` + `docs/GUARDIAN.md` — self-host topology.

**Key verified finding (D-015):** Miden multisig has **no native
size-conditional threshold**, so the cap is enforced app-side via a two-account
model (1-of-1 agent ≤ cap; 2-of-N agent+human Guardian multisig > cap).

**Verified here:** `npm install` (deps incl. `@openzeppelin/miden-multisig-client`
0.14.9 + `@miden-sdk/miden-sdk` 0.14.5) + `npm run typecheck` pass — the agent
compiles against the real Guardian/SDK API surface.
**Needs live run to confirm (documented):** self-hosted Guardian server (docker)
+ a human co-signer for the above-cap path; the `FalconSigner`/`AuthSecretKey`
constructor at runtime; the autonomous path against a funded agent account.

**DoD remaining:** stand up Guardian + create the 2-of-N account + drive an
above-cap trade through human co-sign to on-chain finalize.
## Phase 5 — Demo + tutorial  ✅ (Cusp LP layer ☐)

The DevRel artifact — grounded entirely in verified, on-chain evidence:
- `docs/TUTORIAL.md` — "Building Subrosa on Miden": the build log (env +
  version-matching, the private-position magic moment, the real market
  lifecycle, the web app + its 3 real fixes, the agent + Guardian), honest about
  proven-vs-pending, with real tx hashes.
- `docs/DEMO.md` — 90-second demo script + a "proof, no trust required"
  checklist (public artifacts on the explorer; private accounts = commitment
  only; loser-redeem aborts).

Remaining: Cusp-style LP/capital layer (deposit collateral → back the pool →
earn fees); recorded video; on-chain CPMM/LMSR pricing.

---

## Privacy verification ledger (mandatory for private flows)
> For each private flow: block/tx, what the explorer shows, and the assertion
> that no owner/side/size is revealed. (Empty until Phase 1.)

| Flow | Tx hash | Only commitment on node? | Notes |
|---|---|---|---|
| Mint 250 OBX → private trader (private note) | `0xbc34fd2c…6969` | ✅ yes | node `GetAccountDetails` returns `Private` (commitment `0x8cc01813…`), `account()=None` |
| Consume note into private trader | `0xafe85d7f…8ef1` | ✅ yes | balance held client-side only; not on-chain |
| (control) public OBX faucet | `0x83fc4963…2d34` | ❌ full state | node returns `Public` w/ full Account — as intended |

Verified via `client/src/bin/verify_privacy.rs` on 2026-06-16.
