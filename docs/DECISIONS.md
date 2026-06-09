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
