# Polymarket mirror

Subrosa uses Polymarket as a public market-data and resolution reference. It
does not submit user orders to Polymarket. Stakes, position notes, execution and
redemption remain on Miden.

## Data flow

1. The web server proxies allowlisted Gamma API market lookups at
   `/api/polymarket/markets?slug=...`.
2. The browser normalizes the binary market and displays its YES price as a
   reference beside the independently calculated Miden pool price.
3. A placed position records the Polymarket slug, condition ID and reference
   price in the wallet's private local position metadata.
4. The agent reads the same Gamma market. Its strategy compares the Miden pool
   price with the Polymarket reference, then executes only through Miden.
5. After Polymarket finalizes, an operator relay must verify the outcome and call
   Miden's one-shot `resolve`. The Miden market contract remains the payout
   authority.

The current mirror queues a **public Miden execution note** so the operator can
discover and consume it without a note-transport service. This reveals the
execution note's sender, script and collateral amount. The wallet's local book
is private, but full trade privacy requires encrypted/private note transport or
pooled relayer execution and is not claimed by this beta path.

The testnet market accepts one fungible asset per position but does not yet
pin a single collateral faucet. This supports disposable browser faucets for
the demo, but production deployment must enforce an allowlisted collateral
faucet in the account component.

## Configuration

The default mirror is `will-morocco-win-the-2026-fifa-world-cup-464`.

- Web build: `VITE_POLYMARKET_SLUG`
- Agent: `POLYMARKET_SLUG`
- Agent Gamma endpoint override: `POLYMARKET_GAMMA_URL`

The slug must identify a binary CLOB market. A Miden account must never be
silently remapped after it has accepted stakes; deploy a new Miden market for a
new Polymarket condition.

## Trust boundary

Gamma/CLOB prices are advisory and can be unavailable or manipulated. They do
not authorize payouts. Resolution requires a separate relay policy, including
finality checks, an exact condition-ID allowlist and operator authentication.
Direct Polymarket execution would require a funded Polygon signer and would
leak a Polygon-side trading footprint, so it is intentionally excluded from
the private Miden position flow.
