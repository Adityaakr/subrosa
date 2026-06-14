# Contributing

Subrosa is a research/build project on Miden (pre-mainnet). A few conventions:

- **Verify Miden APIs against live docs/source** before use — the protocol is
  pre-mainnet and changes. See `docs/NOTES_MIDEN.md` for the verified surface and
  `docs/VERSIONS.md` for pinned versions.
- **Work in phases** with a Definition of Done; record evidence (tx hashes,
  explorer links) in `docs/PROGRESS.md` and design choices in `docs/DECISIONS.md`.
- **Privacy is the product** — after any private flow, verify on the node that
  only a commitment is visible (`client/src/bin/verify_privacy.rs`).
- **Never commit secrets.** `.miden/` (keystore, store) is gitignored.

## Layout
- `contracts/` — Miden account components & note scripts (Rust SDK → MASM)
- `client/`    — Rust client binaries (build/prove/submit, privacy checks)
- `scripts/`   — transaction scripts + lifecycle driver
- `web/`       — marketing landing (Phase 3: app + browser proving)
- `docs/`      — plan, decisions, progress, verified Miden notes
