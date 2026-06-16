# NOTES_MIDEN — the Miden model (verified summary)

> Protocol ~v0.14 · `miden-client` v0.15.0 · compiled 2026-06-16.
> Every claim is cited. Items not confirmable from an authoritative source are
> marked **UNVERIFIED** — do not build on them without checking. The public
> docs site is JS-rendered (empty to fetchers); authoritative sources are
> **docs.rs** (exact Rust API) and **`0xMiden/miden-docs` raw markdown** (model).

---

## 1. Accounts

Everything on Miden is an **account** — wallets, smart contracts, and token
faucets alike. An account has four parts:
- **Code** — one or more *components* defining its public API + logic.
- **Storage** — up to **255 typed, name-addressable slots**.
- **Vault** — fungible / non-fungible assets held.
- **Nonce** — counter incremented once per state change (replay protection).

**On-chain vs client-side:** the network stores only **commitments** (hashes of
code, storage, vault) — not full state.
- **Public** storage mode → full state on-chain, visible to all.
- **Private** storage mode → only a state commitment on-chain; data stays with
  the owner. *(This is the privacy primitive Subrosa is built on.)*

**Account types** (`AccountType`): `RegularAccountUpdatableCode`,
`RegularAccountImmutableCode`, `FungibleFaucet`, `NonFungibleFaucet`.
A **faucet** is just an account of faucet type that mints assets.

**Storage slots & maps:** each slot holds either a single `Word` (4 Felts) via
`Value`, or key→value pairs (`Word`→`Word`) via `StorageMap`. Slot IDs derive
from slot **names** (component package + field name), so renaming a field is a
breaking change to stored data. `Value`: `read()`/`write()` (write returns the
*previous* value). `StorageMap`: `get()`/`set()`.

Rust types (`miden_client::account`): `Account`, `AccountBuilder`,
`AccountHeader`, `AccountStorage`, `AccountId`, `AccountIdVersion`, `AccountFile`.

Sources: `miden-docs/.../accounts/{introduction,storage,components}.md`;
`https://docs.rs/miden-client/0.15.0/miden_client/account/index.html`.

→ **Subrosa mapping:** market = **public** account (trustworthy odds); trader &
agent = **private** accounts (confidential positions/strategy).

---

## 2. Notes

A **note** is a UTXO-like object with four parts:
- **Assets** — tokens carried.
- **Script** — code deciding who can consume it + side effects.
- **Inputs/Storage** — data the script reads at consumption.
- **Metadata** — sender id, **note tag** (for discovery), aux data.

**Recipient & nullifier:**
`recipient = hash(hash(hash(serial_num, [0;4]), script_root), storage_commitment)`.
On consumption a **nullifier** is recorded to prevent double-spend.

**Two-transaction model:** sender's tx creates + publishes an output note;
recipient discovers it and consumes it in *their own* tx (note script runs,
checks authorization, assets move into recipient's vault).

**Public vs private notes:** public → full data on-chain; **private → only a
commitment on-chain**, data shared off-chain sender↔recipient. `NoteType`
selects this.

**Standard notes** (precompiled MASM, `miden-standards`):
- **P2ID** (Pay-to-ID) — consumable only by a specific account id.
  `P2idNote::create(sender, target, assets, note_type, attachment, rng)`.
- **P2IDE** (Pay-to-ID-with-Expiration) — adds `timelock_height` (can't consume
  before) and `reclaim_height` (creator reclaims after); both
  `Option<BlockNumber>`, `None` = disabled.
- **SWAP** — atomic exchange (creates a P2ID payback note).
- **Custom notes** — your own note script (see §6).

Sources: `miden-docs/.../notes/{introduction,note-types,note-scripts}.md`.

→ **Subrosa mapping:** position note = **private** note carrying YES/NO shares
into the trader's private account. Settlement window = **P2IDE** time-lock.

---

## 3. Transactions

- Executed **locally** on the user's machine (not a shared VM).
- A tx mutates **exactly one account**; cross-account interaction is via notes.
- **Anatomy:** the single account, input notes (consumed), output notes
  (created), optional **transaction script**, and a block reference.

**Lifecycle — Build → Execute → Prove → Submit → Verify:**
1. **Build** inputs + target account.
2. **Execute** in the Miden VM locally.
3. **Prove** — VM emits a zero-knowledge (STARK) proof of correct execution.
4. **Submit** proof + public state deltas (new note commitments, updated account
   commitment, nullifiers).
5. **Verify** — network checks the proof, records state changes.

Failed assertions block proof generation → tx rejected client-side, **no state
change, no fee**. The network stores proof artifacts + commitments + nullifiers,
**not raw tx data**. The **transaction kernel** (`miden-protocol`) is the
privileged host API (note create/consume, asset moves, storage access);
procedure-level kernel surface = **UNVERIFIED** here.

Source: `miden-docs/.../transactions/introduction.md`; `miden-base/README.md`.

---

## 4. Miden client (Rust) — real API for v0.15.0

> All signatures verified from `https://docs.rs/miden-client/0.15.0/`.

**Instantiate** via `ClientBuilder` (`miden_client::builder`), method-chained:
`.rpc(Arc<GrpcClient>)`, `.store(Arc<SqliteStore>)`,
`.authenticator(Arc<Keystore>)`, `.in_debug_mode(..)`, `.build().await?`.
Convenience: `.for_testnet()`, `.for_localhost()`. (`tonic` feature →
`GrpcClient`; SQLite + IndexedDB store backends exist.)

**Accounts** (`Client`): `add_account(&[Account], overwrite)`,
`import_account_by_id`, `import_watched_account_by_id`, `get_account`,
`try_get_account`, `account_reader`, `get_account_vault`, `get_account_storage`,
`get_account_code`, `get_account_headers`, `prune_account_history`. Build new
accounts with `AccountBuilder` (combine `AccountComponent`s) then `add_account`.

**Transactions** (`Client`):
- `execute_transaction(account_id, TransactionRequest) -> TransactionResult`
- `prove_transaction(&TransactionResult)` / `prove_transaction_with(.., Arc<dyn TransactionProver>)`
- `submit_proven_transaction(ProvenTransaction, impl Into<TransactionInputs>) -> BlockNumber`
- all-in-one: `submit_new_transaction(account_id, req)` /
  `submit_new_transaction_with_prover(..)`
- `get_transactions(TransactionFilter)`, `new_transaction_batch()`

→ flow: `execute_transaction` → `prove_transaction[_with]` →
`submit_proven_transaction`, **or** the one-call `submit_new_transaction`. Local
proving is the default `TransactionProver`; remote via `RemoteTransactionProver`.

**Build requests** — `TransactionRequestBuilder` (`miden_client::transaction`):
config — `new()`, `input_notes()`, `own_output_notes()`, `custom_script()`,
`foreign_accounts()`, `expected_output_recipients()`, `expiration_delta()`,
`script_arg()`, `auth_arg()`, … ; terminal — `build()`, `build_pay_to_id()`
(P2ID/P2IDE), `build_mint_fungible_asset()`, `build_consume_notes()`,
`build_swap()`, `build_register_note_scripts()`, `build_pswap_*()`.

**Sync / query** (`Client`): `sync_state() -> SyncSummary`, `sync_chain()`,
`sync_note_transport()`, `get_sync_height()`, `build_sync_input()`,
`apply_state_sync()`. Note-query method names in `miden_client::note` =
**UNVERIFIED** (module not individually read).

> The rust-client README example still shows `miden-client = "0.13"` — ignore;
> target the version chosen in `VERSIONS.md`.

---

## 5. Miden client CLI

Standalone binary `miden-client` (toolchain `0.14.0` bin). **Full subcommand list
verified locally from `miden-client --help` on 2026-06-16:**
`account`, `new-account`, `new-wallet`, `import`, `export`, `init`,
`clear-config`, `notes`, `sync`, `info`, `tags`, `address`, `tx`, `mint`,
`send`, `swap`, `consume-notes`, `exec`. Global: `-d/--debug`.

Verified flags (from `--help`):
- `init [--local] [-n testnet|devnet|localhost|<rpc>] [--store-path] [--remote-prover-endpoint] [--note-transport-endpoint]`
  → writes `miden-client.toml` (+ `store.sqlite3`, `keystore/`, `packages/`).
  `--local` puts a `.miden/` dir in cwd. Default network is testnet; default RPC
  written is `https://rpc.testnet.miden.io` (note transport `transport.miden.io`).
- `new-wallet [-s private|public] [-m/--mutable] [-e extra-packages] [-i init-storage] [--deploy]`.
  `--deploy` submits an **authentication transaction** to the network (this is a
  real on-chain tx — used for the Phase-0 hello-world).
- `new-account --account-type fungible-faucet|non-fungible-faucet|regular-account-immutable-code|regular-account-updatable-code [-s private|public] [-p packages] [-i init-storage] [--deploy]`.
  Default auth component is `RpoFalcon512` (override via `-p auth/<scheme>`;
  available: `basic-auth`, `acl-auth`, `ecdsa-auth`, `multisig-auth`, `no-auth`).
- `mint --target <ID> --asset <AMOUNT>::<FAUCET_ID|SYMBOL> --note-type public|private [--force] [--delegate-proving]`.
  ⚠️ `mint` mints **from a fungible faucet you control** → for Subrosa's
  test-collateral we create our own faucet (`new-account --account-type
  fungible-faucet -p basic-fungible-faucet.masp`), not an external web faucet.
- `account` (list) · `account -s <ID>` (detail) · `account --default <ID>`.
- `sync` · `info` · `tx` (list) · `send` (pay-to-id) · `consume-notes` · `swap` · `exec`.

Bundled component packages (in `.miden/packages/`): `basic-wallet.masp`,
`basic-fungible-faucet.masp`, and `auth/*.masp`. Explorer:
`https://testnet.midenscan.com`. Library mapping: send→`build_pay_to_id`,
consume→`build_consume_notes`, swap→`build_swap`, mint→`build_mint_fungible_asset`.

---

## 6. MASM / account procedures & note scripts

Miden VM runs **Miden Assembly (MASM)**. The current high-level authoring path
is a **Rust SDK with macros** that compiles to MASM:

- **Account code = components.** `#[component]` on a struct + impl. Storage
  fields annotated `#[storage(..)]`, typed `Value` (slot) or `StorageMap`.
  `&self` = read-only; `&mut self` = may write storage / move assets / create
  notes. Generated helpers: `add_asset`, `remove_asset`, `incr_nonce`, `get_id`,
  `get_balance`, … Components compose on one account (wallet + auth + custom).
- **Note scripts** = `#[note]` struct (inputs) + impl with a `#[note_script]`
  method; entry takes `self` by value + a `Word` arg, optional `&mut Account`.
  Declared in `Cargo.toml` `[package.metadata.miden]` (`project-kind =
  "note-script"`) with dependencies on account components.

Examples: standard notes/components in `miden-standards`; first-contract +
tutorials under `miden-docs/.../get-started/` and `.../tutorials/`.

Source: `miden-docs/.../accounts/components.md`, `.../notes/note-scripts.md`.

---

## 7. Component → Miden primitive map (Subrosa)

| Subrosa component | Miden primitive(s) | Privacy |
|---|---|---|
| Market account | **public** (network) account + components + storage maps | reserves/odds/resolution public |
| Position note | **private** note (P2ID-style) into a private account | owner/side/size hidden |
| Settlement window | **P2IDE** time-locked note | bounded redemption |
| Trader / agent identity | **private** account + client-side proving | only commitments on-chain |
| Agent guardrails | programmable auth (per-procedure thresholds) | autonomous ≤ cap; co-sign above |
| Resolution | optimistic resolver (default) / Pragma (upgrade) | outcome public |

---

## 8b. Verified node-RPC API (compiled against `miden-client` 0.14.9)
For querying on-chain state directly from the node (used in the privacy proof):
- `miden_client::rpc::Endpoint::testnet() -> Endpoint` (also `devnet()`/`localhost()`;
  `Endpoint::new(protocol: String, host: String, port: Option<u16>)`;
  `TryFrom<&str>` parses `"https://rpc.testnet.miden.io"`).
- `miden_client::rpc::GrpcClient::new(endpoint: &Endpoint, timeout_ms: u64) -> GrpcClient`
  (feature `tonic`; builder `.with_bearer_auth(String)` for gateway auth — not
  needed for low-volume testnet reads). **Note:** takes a single `&Endpoint`, not a
  slice (docs.rs summary was wrong; compiler is truth).
- trait `miden_client::rpc::NodeRpcClient`: `get_account_details(AccountId) ->
  Result<FetchedAccount, RpcError>` (async).
- `miden_client::rpc::domain::account::FetchedAccount`:
  `Public(Box<Account>, AccountUpdateSummary)` | `Private(AccountId,
  AccountUpdateSummary)`; accessors `account() -> Option<&Account>` (Some only for
  public), `commitment() -> Word`, `account_id() -> AccountId`. **This is the
  privacy oracle:** private accounts → node has only a commitment.
- `miden_client::account::AccountId::from_hex(&str) -> Result<AccountId, _>` parses
  `0x…` ids.

## 8. UNVERIFIED — confirm before building on these
1. ~~Exact CLI flag syntax~~ → **RESOLVED** (verified from `miden-client --help`, §5).
2. Transaction-kernel procedure API (confirmed only to live in `miden-protocol`).
3. Note-query method names on `Client` / `miden_client::note` (CLI `notes` works).
4. Live testnet RPC = `rpc.testnet.miden.io` (**verified working** 2026-06-16);
   still subject to ops rotation per status page.
5. Client/node version: **node is 0.14-series → using client `0.14.9`** (0.14.4
   had a sync protobuf bug; 0.15.0 rejected by node). Verified end-to-end.
6. Custom account components / note scripts (Rust SDK → MASM) — next, for the
   market account + position note (Phase-1 magic moment).

## Source index
- docs.rs (authoritative Rust API): `https://docs.rs/miden-client/0.15.0/miden_client/`
- Concepts (raw md): `https://github.com/0xMiden/miden-docs` →
  `docs/builder/smart-contracts/{accounts,notes,transactions}/…`
- `https://github.com/0xMiden/miden-base` (README → crate layout)
- Network/status: `https://status.testnet.miden.io/` · Explorer: `https://testnet.midenscan.com`
