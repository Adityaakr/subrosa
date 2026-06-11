# DECISIONS — design choices + rationale

Append-only log.

### D-001 · Monorepo layout; landing under web/landing
Keep the spec's monorepo (contracts/client/agent/scripts/tests/web); tracking
docs live in docs/.

### D-002 · Target the midenup-managed 0.14 toolchain
Use the midenup toolchain for tooling consistency (revisit if the node needs newer).

### D-003 · Optimistic resolver as default resolution
An authorized resolver posts the outcome; no external oracle dependency for the demo.

### D-004 · CPMM pricing for v1, fixed-point integers
Odds derived from reserves; trivial CPMM to de-risk in-VM math (LMSR is a fast-follow).

### D-005 · v1 privacy = identity privacy only
Who-holds-what is private; per-trade amount leakage via AMM deltas documented, not hidden.

### D-006 · Landing fonts via Google Fonts
Same three faces (Space Grotesk / Inter / JetBrains Mono) without shipping woff2 binaries.

### D-007 · Upgrade client to 0.14.9 to match the testnet node
0.14.4 broke on sync (protobuf wire mismatch); 0.15.0 rejected by the node. The
node is a 0.14-series node → pin the latest 0.14.x client.

### D-008 · Version pinned to 0.14.9 (supersedes D-002)
Verified end-to-end: init → sync → deploy → mint → consume on testnet.

### D-009 · Minimal market = public component with reserves + trivial CPMM
Public storage (yes/no/volume) + place(); odds computed off-chain; no in-field division.

### D-010 · Toolchain split: midenup 0.14 for contracts, client 0.14.9
Contracts build via `cargo miden`; client ops via the standalone CLI/lib.
