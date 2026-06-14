# agent/ — confidential trading agent (Phase 4, planned)

The confidential agent layer: an AI agent that trades from its **own private
Miden account**, so its strategy and book stay confidential.

- **Brain (off-chain):** reads public market odds + external signals → decides a
  target position.
- **Guardrails (on-chain):** Miden programmable auth — autonomous up to a size
  cap; trades above the cap require a human co-signature. Risk limits live in the
  account's auth, not just app code.
- **Privacy:** every trade is a private transaction from the agent's private
  account → strategy/book not reconstructable on-chain.

Builds on the proven private-position flow in `client/` and `scripts/`.
See `docs/PLAN.md` (Phase 4) and the spec's confidential-agent section.
