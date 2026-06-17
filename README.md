<div align="center">

<img src="web/app/public/logo/subrosa-mark.svg" alt="Subrosa" height="84" />

# Subrosa

**Private prediction markets with confidential AI agents, on [Miden](https://miden.xyz).**

Public, trustworthy **odds** — but your **position, size, and P&L stay private**.
The chain records only a *commitment*.

[![Miden](https://img.shields.io/badge/Miden-testnet-FF5500)](https://testnet.midenscan.com)
[![Guardian](https://img.shields.io/badge/Guardian-OpenZeppelin-7D56F3)](https://github.com/OpenZeppelin/guardian)
[![License](https://img.shields.io/badge/license-AGPL--3.0-555)](./LICENSE)

</div>

---

## Why Subrosa

On a normal prediction market, everyone can see *who* bet, on *what side*, for *how much*. That leaks your edge, invites copy-trading, and makes a confidential trading strategy impossible.

Subrosa flips the privacy model using Miden's client-side execution:

|                       | Public (on-chain, verifiable) | Private (commitment only) |
| --------------------- | ----------------------------- | ------------------------- |
| Market **odds**       | ✅ reserves are public         |                           |
| Total **volume**      | ✅                             |                           |
| **Resolution** outcome| ✅                             |                           |
| Your **side**         |                               | 🔒                        |
| Your **size**         |                               | 🔒                        |
| Your **identity**     |                               | 🔒                        |
| Your **P&L**          |                               | 🔒                        |

The odds stay trustworthy *because* the reserves are public — but a position is a **private note**, so the network only ever sees a hash. That's the whole product: **trustworthy odds, confidential positions.**

---

## Architecture

```mermaid
---
config:
  look: handDrawn
  theme: neutral
---
flowchart TB
  subgraph Browser["🖥️  Browser — everything client-side"]
    UI["React dapp<br/>Vite + Miden WASM"]
    Wallet["Wallet<br/>built-in · or MidenFi ext"]
    Prover["STARK prover<br/>in-browser WASM"]
  end

  subgraph Miden["⛓️  Miden testnet"]
    Market["Market accounts — PUBLIC<br/>yes/no reserves · volume · resolution"]
    Faucet["OBX faucet — PUBLIC<br/>test collateral"]
    Pos["Position notes — PRIVATE<br/>commitment only"]
  end

  subgraph Off["🤖  Off-chain (self-hosted)"]
    Agent["Confidential agent<br/>OpenRouter LLM brain"]
    Guardian["Guardian server<br/>2-of-N co-sign · Postgres"]
    Operator["Operator<br/>resolve · redeem"]
  end

  UI --> Wallet --> Prover
  Prover -->|"proven tx"| Market
  Prover -->|"private note"| Pos
  UI -->|"read live odds"| Market
  Faucet -->|"mint OBX"| Wallet
  Agent -->|"reads odds → trades"| Market
  Agent -.->|"above cap"| Guardian
  Guardian -->|"co-signed tx"| Market
  Operator -->|"resolve / payout"| Market
```

**Four layers:**

1. **Frontend** (`web/app`) — a React dapp that runs the **Miden WASM client in the browser**: it builds, executes, and STARK-proves transactions locally, then submits the proof. Nothing about your position leaves your machine in the clear.
2. **Contracts** (`contracts/`) — the `market` **account component** (public reserves + CPMM odds) and **private position notes** with an on-chain redemption guard.
3. **Confidential agent** (`agent/`) — an autonomous trader with an LLM brain and a programmable-auth risk cap.
4. **Guardian** (OpenZeppelin) — a self-hosted 2-of-N co-sign coordinator for trades above the agent's cap.

---

## How it works

### 1 · Placing a private position

```mermaid
---
config:
  look: handDrawn
  theme: neutral
---
sequenceDiagram
  actor U as You
  participant App as Dapp (browser)
  participant W as Wallet + Prover (WASM)
  participant M as Market account (public)
  participant Ch as Miden chain

  U->>App: pick side + size
  App->>W: build position note, stake OBX
  W->>W: execute + STARK-prove locally
  W->>Ch: submit proof only
  Ch->>M: reserves move → public odds shift
  Ch-->>App: note commitment = your private position
  Note over U,Ch: Chain sees a commitment + new odds —<br/>never your side, size, or identity.
```

Your stake collateralizes the bet (balance actually drops), the market's public reserves move (so the odds are real), and you receive a **private note** whose commitment is all the chain stores. The dapp shows you both hashes: the public **transaction** and your private **position commitment**.

### 2 · Resolution & redemption

The market account has a one-shot `resolve(outcome)` written by a designated resolver key. Settlement is **trustless on-chain**: a position note calls `redeem(outcome, shares)`, which **asserts the market is resolved AND your side won** — losing or invalid notes simply *abort* the proof. No winner list, no oracle trust in the payout path.

### 3 · The confidential agent + programmable-auth cap

```mermaid
---
config:
  look: handDrawn
  theme: neutral
---
flowchart LR
  A["read live<br/>on-chain odds"] --> B["decide<br/>OpenRouter LLM"]
  B --> C{"size ≤ cap?"}
  C -->|"yes"| D["autonomous<br/>private trade"]
  C -->|"no"| E["raise request →<br/>Guardian 2-of-N"]
  E --> F["human co-signs<br/>in Approvals"]
  F --> D
  D --> G["reserves move<br/>on-chain"]
  G -->|"loop every N min"| A
```

The agent trades from its **own private account**, so its strategy and book stay hidden — an edge that can't be copied. Miden has no native *size-conditional* multisig, so the cap is enforced app-side: **at/below cap → the agent acts alone; above cap → it must get a human co-signature**, coordinated by Guardian. The loop ships with real safety rails (budget, max-trades, kill-switch file, error backoff, stand-down on resolution).

### 4 · Guardian co-sign (Approvals)

```mermaid
---
config:
  look: handDrawn
  theme: neutral
---
sequenceDiagram
  participant Ag as Agent
  participant UI as Approvals (dapp)
  participant Hu as Human
  participant G as Guardian server
  participant Ch as Miden chain

  Ag->>UI: wants to deploy above its cap
  UI->>Hu: pending 2-of-N request
  Hu->>G: Co-sign (agent + human signatures)
  G->>G: verify deltas against chain
  G->>Ch: execute co-signed multisig tx
  Ch-->>UI: GUARDIAN VERIFIED ✓
```

Guardian is **non-custodial** — it coordinates and acknowledges, it never holds a spending key. It's a resilience/coordination layer, self-hosted so private payloads never leave infrastructure you control.

---

## Live on Miden testnet

Every market is a **public account** — open it on the explorer and verify the reserves/resolution yourself (the dapp links to these via *“verify on-chain”*):

| Market | Account ID | Explorer |
| ------ | ---------- | -------- |
| Will ETH close above $4,000? | `0x612f7f710da01a10116a1ca76afac5` | [view](https://testnet.midenscan.com/account/0x612f7f710da01a10116a1ca76afac5) |
| Will Miden mainnet launch before Aug 1? | `0x5ff0303f0b795d1039ca5b51d8480b` | [view](https://testnet.midenscan.com/account/0x5ff0303f0b795d1039ca5b51d8480b) |
| Will the Fed cut rates in September? | `0x7003429f9cdb431056970e854e5ed6` | [view](https://testnet.midenscan.com/account/0x7003429f9cdb431056970e854e5ed6) |
| OBX test-collateral faucet | `0x1201d9f8819d5220778535e4e2f08a` | [view](https://testnet.midenscan.com/account/0x1201d9f8819d5220778535e4e2f08a) |

---

## Tech stack

| Layer | Stack |
| ----- | ----- |
| **Contracts** | Rust + Miden SDK 0.12 → `cargo miden build` → MASM `.masp` |
| **Chain ops** | `miden-client` 0.14 (account creation, prove, submit) |
| **Frontend** | React 19 · Vite · `@miden-sdk/react` + `@miden-sdk/miden-sdk` 0.14.11 · in-browser WASM proving |
| **Wallets** | built-in web-SDK wallet · MidenFi browser extension (wallet-adapter) |
| **Agent** | Node + `tsx` · OpenRouter (`gpt-4o-mini`) · heuristic fallback |
| **Co-sign** | OpenZeppelin **Guardian** (Rust + Postgres) · `@openzeppelin/miden-multisig-client` |
| **Deploy** | Railway (Docker) — see [`docs/DEPLOY.md`](./docs/DEPLOY.md) |

**Cross-origin isolation:** the WASM client needs `SharedArrayBuffer`, so the app serves `COOP: same-origin` + `COEP: credentialless` — the latter lets the client talk **directly** to the public testnet RPC/prover without a proxy.

---

## Repository layout

```
subrosa/
├── contracts/
│   └── market/        Miden account component: place / resolve / redeem, public reserves
├── client/            Rust bins: run_script, place_position, verify_privacy
├── scripts/           compiled tx-scripts (place/resolve/redeem) + operator/lifecycle
├── agent/             confidential agent loop · LLM brain · Guardian · fund/redeem services
│   └── docker/        self-hosted Guardian compose
├── web/
│   ├── app/           the React dapp (landing + /app + /cosign) — deployed frontend
│   └── landing/       standalone marketing page
└── docs/              DEPLOY · GUARDIAN · DECISIONS · architecture notes
```

---

## Run it locally

**Frontend (the dapp):**
```bash
cd web/app
npm install
npm run dev            # → http://localhost:5173  (landing) ·  /app/  (dapp)
```
Connect the built-in wallet, click **Fund** (in-browser OBX faucet), and place a position — it proves in your browser and lands on testnet.

**Confidential agent (autonomous trading):**
```bash
cd agent
npm install
npm start              # reads odds → LLM decides → places · every 5 min
SUBROSA_DRY_RUN=1 npm start   # decide + log, never submit (safe anywhere)
```

**Guardian server (for the co-sign path):**
```bash
git clone https://github.com/OpenZeppelin/guardian ../guardian
cd agent && npm run guardian:up        # Docker → :3000 / :50051  (needs DATABASE_URL)
```

> Markets, wallets, funding, and positions work with just the frontend. The agent
> loop and operator services need the native `miden-client` toolchain + a funded
> keystore. Full deployment guide: [`docs/DEPLOY.md`](./docs/DEPLOY.md).

---

## Principles

- **Privacy is the product** — every private flow is provable on the explorer (commitment in, nothing leaked).
- **Verify every Miden API before use; pin versions; build phase by phase.**
- **Public reserves = trustworthy odds; private notes = confidential positions.**

<div align="center"><sub>Built on Miden · "sub rosa" — under the rose, in confidence.</sub></div>
