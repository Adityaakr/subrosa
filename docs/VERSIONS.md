# VERSIONS - active toolchain

Verified on 2026-07-05 against Miden testnet.

| Component | Version |
|---|---|
| `miden-client` CLI | `0.15.3` |
| `@miden-sdk/miden-sdk` web packages | `0.15.4` |
| `cargo-miden` | `0.9.0` |
| Contract `miden` crate | `0.13` |
| Contract Rust toolchain | `nightly-2026-04-30` (`rustc 1.97.0-nightly`) |
| Node | `v24.14.1` |
| npm | `11.11.0` |

`cargo-miden 0.9.0` emits MASP v4 packages accepted by the 0.15 client. The
compiler currently logs `UntrustedMastForest expected HASHLESS/STRIPPED` during
valid builds; commands exit successfully and the generated packages deserialize
and execute with the 0.15.4 browser SDK.

## Verified flow

The active Polymarket mirror account is
`0xabbba77bce4bc6d1795be21b30fa5e`. A browser wallet queued a 100 OBX public
execution note, and the operator consumed it on testnet. The resulting state is
YES reserve 5,100 OBX, NO reserve 5,000 OBX, volume 100 OBX.

Network defaults:

- RPC: `https://rpc.testnet.miden.io`
- Explorer: `https://testnet.midenscan.com`
