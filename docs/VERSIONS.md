# VERSIONS — pinned toolchain & dependencies

> Spec rule 2: record exact installed versions; do not silently upgrade mid-build.
> Recorded 2026-06-16.

## 0.15 testnet migration — known gaps (2026-06-25)

The testnet reset to **Miden 0.15**. The web client/SDK were upgraded to `0.15.2`
and funding works. Two things are blocked on factors outside this repo:

- **Placing positions — contract packages.** The 0.15 client requires package
  format **v3**; our compiled `place_note.masp` / `market.masp` are **v2**
  (`"Got [0,0,2], only [0,0,3] supported"`). The published contract compiler
  (`cargo-miden 0.8.1`, `miden-mast-package 0.22`) only emits v2; the only v3
  source is the compiler's unreleased `next` branch (`miden-mast-package 0.23`),
  which currently fails packaging with an internal MAST serialization error
  (`UntrustedMastForest expected HASHLESS/STRIPPED`). **No working toolchain
  emits v3 yet.** Interim: `place()` stakes OBX into a private **P2ID own-output
  note** (`NoteScript.p2id()` + `withOwnOutputNotes`, no note transport, no
  custom `.masp`) — a real private on-chain commitment. The market-procedure call
  that moves public odds is deferred until the v3 toolchain + redeployed market
  accounts land (restore the `place_note.masp` build at `web/app/src/proto/app.tsx`).
- **Guardian co-sign.** Requires the self-hosted Guardian server at **v0.15.0**
  (Miden 0.15). A 0.14 server 502s with `` `1` is not a known account ID version``.
  Co-sign now fails gracefully (places directly) until the Railway Guardian is
  redeployed at `v0.15.0`.

## Host toolchain (verified locally)

| Tool | Version | Notes |
|---|---|---|
| rustc | `1.95.0 (59807616e 2026-04-14)` | Miden client needs ≥ 1.88 ✓ |
| cargo | `1.95.0 (f2d3ce0bd 2026-03-21)` | |
| node | `v24.14.1` | for web client + agent runner |
| npm | `11.11.0` | |
| git | `2.50.1 (Apple Git-155)` | |

## Miden toolchain (verified locally)

| Component | Version | How |
|---|---|---|
| `midenup` (porcelain) | `0.2.0` | `cargo install midenup && midenup init` |
| active Miden toolchain | `0.14.0` | `midenup show active-toolchain` |
| `miden` symlink | → `~/.cargo/bin/midenup` | `miden --version` works |

`midenup` manages the active toolchain and installs components on demand. The
`miden` command is the porcelain entry point (`miden help`, `miden client …`,
`miden help toolchain`).

## Miden crates (from crates.io / docs.rs — for the Rust `client/`)

| Crate | Latest published | **Target for this build** |
|---|---|---|
| `miden-client-cli` (CLI) | `0.15.0` | **`0.14.9`** — matches the live testnet node |
| `miden-client` (lib) | `0.15.0` (2026-06-12) | `0.14.9` (pin Rust `client/` to match CLI) |
| `miden-base` crates (`miden-protocol`, `miden-standards`, `miden-tx`) | track `miden-base` | verify per-component before use |

**Version matching — RESOLVED (see DECISIONS D-002/D-007/D-008):**
The pinned version is driven by the **live testnet node**, not by "latest":
- `midenup` ships only the `0.14.0` channel → client `0.14.4`. Worked for
  init/sync/deploy/mint-submit, but `miden-client sync` then failed with a
  Protobuf wire-type error (`AccountId.id` `SixtyFourBit` vs `LengthDelimited`)
  decoding `SyncTransactionsResponse` → 0.14.4 protobuf is behind the node.
- `0.15.0` is **rejected by the node** at the accept-header (`version mismatch`)
  → the node is a **0.14-series** node, not 0.15.
- crates.io has 0.14.x patches up to **`0.14.9`**. Plan: run **`0.14.9`** (latest
  0.14-series → passes the node's accept-header AND carries the 0.14 protobuf
  fixes). Verifying end-to-end now.

Install: `cargo install miden-client-cli --version 0.14.9 --locked`
(binary → `~/.cargo/bin/miden-client`). The `midenup` toolchain `0.14.0` is still
used for `miden-vm` / `midenc` / `cargo-miden` (MASM compilation).

**✅ VERIFIED end-to-end on `0.14.9`** (2026-06-16): init → sync → faucet deploy →
private wallet → mint private note → sync (no protobuf error) → consume →
node-level privacy assertion. `client/` builds & runs against it.

### Resolved crate versions (from `client/` build with `miden-client = 0.14.9`)
| Crate | Version |
|---|---|
| `miden-client` | `0.14.9` |
| `miden-tx` | `0.14.5` |
| `miden-protocol` | `0.14.5` |
| `miden-standards` | `0.14.5` |
| `miden-core-lib` | `0.22.4` |
| `miden-assembly` | `0.22.4` |
| `miden-remote-prover-client` | `0.14.10` |
| `tonic` | `0.14.6` |

`client/Cargo.toml` pins `miden-client = "=0.14.9"` with the `tonic` feature.

## Network

| Thing | Value | Source / caveat |
|---|---|---|
| Testnet RPC (default) | `https://rpc.testnet.miden.io` | docs note the ops team **rotates** this; confirm via `https://status.testnet.miden.io/` |
| Testnet explorer | `https://testnet.midenscan.com` | for privacy verification |
| `init` networks | `localhost` / `devnet` / `testnet` / `<custom_rpc>` | `miden client init --network testnet` |

## Sources
- crates.io API: `https://crates.io/api/v1/crates/miden-client` → 0.15.0
- docs.rs: `https://docs.rs/miden-client/0.15.0/miden_client/`
- midenup install: `https://docs.miden.xyz/builder/tools/midenup/`
- network: `https://status.testnet.miden.io/`, `miden-docs/.../tools/network.md`
