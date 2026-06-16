# Building Subrosa — a private prediction market on Miden

A build log you can follow. Subrosa is a binary prediction market where **odds
are public** but each **position is private** — the chain stores only a
commitment. Everything below ran on **Miden testnet**; transaction hashes are
real and verifiable on [testnet.midenscan.com](https://testnet.midenscan.com).

> Codename note: the working name in the code/landing is "Subrosa"; the project
> is "Subrosa" (sub rosa = in secret).

---

## 0. Environment — and a version lesson that mattered

Miden is pre-mainnet, and **the client must match the node** or nothing works.
The honest sequence we hit:

1. Installed the toolchain: `cargo install midenup && midenup init` → `miden`
   (porcelain 0.2.0, toolchain `0.14.0`).
2. The bundled CLI was `miden-client 0.14.4`. It created accounts and submitted
   transactions fine, but `sync` then failed with a **Protobuf wire-type error**
   — the 0.14.4 client couldn't decode this node's responses.
3. `0.15.0`? The node **rejected it** at the accept-header. So the node is a
   **0.14-series** node — not older, not newer.
4. Fix: `cargo install miden-client-cli --version 0.14.9` (latest 0.14.x). Clean
   end-to-end. Pinned in `VERSIONS.md`.

**Lesson:** on a pre-mainnet chain, treat "latest" as wrong by default — pin to
what the node speaks. The same bit us later in the browser (web SDK 0.14.4 →
0.14.11). See `DECISIONS.md` D-007/D-008.

---

## 1. The magic moment — a private position

The core claim: a position is invisible on-chain. We proved it, didn't assume it.

- Created an OBX "collateral" faucet (public) and a **private** trader wallet.
- Minted 250 OBX to the trader as a **private note**; the trader consumed it.
- Then queried the **node directly** (`client/src/bin/verify_privacy.rs`,
  `GetAccountDetails` RPC):
  - public faucet → `FetchedAccount::Public` (full state)
  - private trader → `FetchedAccount::Private` — **commitment only**, `account()`
    is `None`. No vault, no balance, no position.

```
$ cargo run --bin verify_privacy
OBX faucet      -> FULL on-chain state (PUBLIC)
trader wallet   -> COMMITMENT ONLY (PRIVATE)  → 250 OBX not on-chain
```

That's the unlock: **the node literally cannot see the position.**

---

## 2. A real market — custom contract, on-chain

Wrote the market as a Miden **account component** in Rust (`contracts/market/`),
compiled to MASM with `cargo miden build`:

- Public storage: `yes_reserve`, `no_reserve`, `total_volume`, `resolution`.
- Procedures: `place(side, amount)` (trivial CPMM, field-add only — no in-field
  division), `resolve(outcome)` (one-shot optimistic resolver), and a
  **redemption guard** `redeem(outcome, shares)` that asserts the market is
  resolved *and* the outcome won — else the transaction aborts.

Deployed it as a **public** account, then drove the full lifecycle on testnet via
a transaction script (`scripts/place_yes` etc.) submitted with the client
library (`client/src/bin/run_script.rs`, local proving):

| Step | Tx | Result |
|---|---|---|
| place YES 250 | `0x64b227b6…` | `yes_reserve` 1000 → 1250 |
| place NO 100 | `0xf7ab5690…` | `no_reserve` 1000 → 1100 |
| resolve YES | `0xf1f5ee8c…` | `resolution → 1` |
| redeem YES (winner) | `0x1eb19f2f…` | ✅ succeeds |
| redeem NO (loser) | — | ✅ **aborts** (`FailedAssertion` — never hits the network) |

Odds moved with each trade; the loser's redeem fails client-side at execution.
That's trustless settlement, verified on-chain.

### Real private payout
A market composed with `basic-wallet` was funded with 1000 OBX, resolved YES,
then **paid the winner 250 OBX as a private P2ID note** (`send --note-type
private`, tx `0x4c745d37…`). The node shows the winner as **commitment-only**;
pool dropped 1000 → 750 OBX. Real collateral, private payout.

---

## 3. The web app — proving in your browser

`web/app/` is Vite + React + the official Miden **web SDK** (`@miden-sdk/*`,
pinned `0.14.11` to match the node). A **local prover** means accounts and
transactions are proved **in the browser** — no extension, no server.

What it does (verified rendering in a real browser):
- Reads the deployed market's **public reserves live from the node**
  (`getAccount → storage().getItem(slot)`), shows an odds bar.
- "Place private position" → creates a **private account in-browser** (proved
  locally), shows a **privacy seal** ("the network records only a commitment —
  no holder, side, or size") and a PRIVATE positions list.

### Three real bugs we fixed (all version/build, not logic)
1. `useMidenClient()` **throws before init** → switched to the nullable `client`
   from `useMiden()` so the hook is init-safe.
2. Web SDK `0.14.4` → **"invalid enum value"** decoding node responses (same
   class as the CLI 0.14.4 bug) → bumped to `0.14.11`.
3. Production build: the SDK's classic worker fetches
   `new URL("assets/miden_client_web.wasm", self.location.href)`, but `vite
   build` flattened the worker into `/assets/` so the relative path 404'd →
   HTML → `WebAssembly.instantiate: expected magic word`. Fixed with a
   post-build copy to the exact path the worker requests (`scripts/copy-wasm.mjs`).

**Honest limit:** the browser "place" creates+proves the private account and
records the position; moving the *shared* public reserves from a browser user
requires a **network-mode** market the testnet operator executes (the
`place_note` mechanism is built; see §5).

---

## 4. The confidential agent + Guardian co-sign

`agent/` is an agent that trades from a private account with a programmable-auth
guardrail, using self-hosted **OpenZeppelin Guardian** for the human co-sign.

- read public odds → decide (private brain) → route by size:
  - `size <= CAP` → autonomous private trade
  - `size > CAP` → Guardian multisig proposal → human co-signs → execute
- **Verified finding:** Miden multisig has **no native size-conditional
  threshold**, so the cap is enforced app-side via a **two-account model**
  (1-of-1 agent ≤ cap; 2-of-N agent+human Guardian multisig > cap). See
  `GUARDIAN.md`, `DECISIONS.md` D-015.
- Built against the real `@openzeppelin/miden-multisig-client` API; `npm run
  typecheck` passes. Live co-sign needs the Guardian docker server + a human.

---

## 5. What's proven vs. what's next (honest)

**Proven on-chain / verified:**
- Private positions are commitment-only at the node (§1).
- Custom market: place/resolve/redeem + real private payout, with tx hashes (§2).
- Web app builds, serves, and runs in a browser: in-browser proving, live odds,
  private account + seal (§3).
- Agent + Guardian integration compiles against the real SDKs (§4).

**Next (built mechanism, needs an off-machine/operator step to finish):**
- Browser bet that moves the *shared* odds: needs a **network-mode** market
  (web SDK `AccountBuilder` + `AccountStorageMode.network()`) so the testnet
  operator executes the `place_note` (built: `contracts/notes/place_note`,
  `web/app/public/packages/place_note.masp`). Async operator step.
- Guardian live co-sign (docker + human); on-chain CPMM/LMSR pricing; Cusp LP.

---

## Reproduce it
```bash
# contracts / client (Rust)
cd contracts/market && cargo miden build           # market.masp
cd ../../client && cargo run --bin verify_privacy  # node-level privacy proof

# web app (in-browser proving)
cd web/app && npm install && npm run dev           # http://localhost:5173

# agent (typecheck)
cd agent && npm install && npm run typecheck
```
Full evidence (tx hashes, explorer links, decisions): `docs/PROGRESS.md`,
`docs/DECISIONS.md`, `docs/DEMO.md`.
