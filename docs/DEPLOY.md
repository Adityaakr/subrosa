# Deploying Subrosa on Railway

Subrosa is three separable pieces. Only the first two belong in the cloud; the
agent/operator tooling needs native Miden binaries + a funded keystore and is
best run from your own machine (or skipped for a public demo).

| Service | Deploy? | Notes |
|---|---|---|
| **web** (frontend, `web/app`) | ✅ Railway | Static build served by `vite preview` with the WASM isolation headers + `/guardian` proxy. Has a `Dockerfile`. |
| **guardian** (OpenZeppelin Guardian) | ✅ Railway | Docker, backed by your Railway **Postgres**. HTTP `:3000`, gRPC `:50051`. Only needed for co-sign. |
| **agent / redeem-service / fund-service** (`agent/`) | ⚠️ local | Shell out to `miden-client` / `run_script` and need the operator `.miden` keystore. Not cloud-friendly. The frontend works **without** them. |

The frontend needs no backend for its core flows: funding uses an **in-browser**
web faucet, markets read **directly** from testnet, and positions are proved in
the browser. Only the **Redeem** button (resolved markets) needs `redeem-service`.

---

## 1. Frontend service (`web`)

- **Root directory**: `web/app`
- **Builder**: Dockerfile (auto-detected — `web/app/Dockerfile`)
- Railway injects `$PORT`; the image binds `0.0.0.0:$PORT`.
- Generate a **public domain** in Railway → that's your live URL.

**Variables:**

| Var | Required | Value |
|---|---|---|
| `GUARDIAN_URL` | for co-sign | The Guardian service URL the `/guardian` proxy forwards to. Easiest: give Guardian a public domain and set `https://<guardian-domain>` (Railway TLS-terminates to the container). Private-networking alt: `http://${{guardian.RAILWAY_PRIVATE_DOMAIN}}:3000`. |
| `VITE_REDEEM_ENDPOINT` | optional | URL of a `redeem-service` you run (e.g. `https://<host>/redeem`). Omit if you're not running redemption — the rest of the app is unaffected. |

> Testnet RPC + prover (`rpc.testnet.miden.io`, `tx-prover.testnet.miden.io`) are
> public and baked in — no env needed.

---

## 2. Guardian service (`guardian`)

Deploy the upstream **[OpenZeppelin/guardian](https://github.com/OpenZeppelin/guardian)**
as its own Railway service (point a service at that repo, or its Docker image).
Build it with the postgres feature: `GUARDIAN_SERVER_FEATURES=postgres`.

> **Pin Guardian to `v0.15.0` or newer.** The server must run the **Miden 0.15**
> libraries to match the testnet (and the `@openzeppelin/miden-multisig-client@^0.15`
> the dapp uses). An older Guardian (0.14.x) rejects every 0.15 account at
> `registerOnGuardian` with a `502`:
> `Failed to validate credential: … invalid value: \`1\` is not a known account ID version`.
> Deploy the `v0.15.0` git tag and redeploy whenever the testnet/SDK major moves.

**Variables:**

| Var | Required | Value |
|---|---|---|
| `DATABASE_URL` | ✅ | Your Railway Postgres URL — reference it as `${{Postgres.DATABASE_URL}}` so it stays out of code. |
| `GUARDIAN_NETWORK_TYPE` | ✅ | `MidenTestnet` |
| `GUARDIAN_MAX_PENDING_PROPOSALS_PER_ACCOUNT` | | `20` |
| `RUST_LOG` | | `info` |

Expose port **3000** (HTTP REST — what the multisig client uses). A public domain
is only needed if you wire `GUARDIAN_URL` to the public URL (recommended for
reliability over Railway private networking).

---

## 3. Postgres

You already have it. Just reference `${{Postgres.DATABASE_URL}}` from the Guardian
service. No schema setup needed — Guardian migrates on boot.

---

## Secrets — never commit

`DATABASE_URL` and `OPENROUTER_API_KEY` live only in Railway service **Variables**
(and the gitignored `agent/.env` locally), never in the repo.

---

## What's live vs. local

**Live on Railway:** landing page, connect wallet (built-in + MidenFi), in-browser
funding, 3 live markets read from testnet, placing private positions (browser
proving), on-chain "verify" links, Guardian co-sign (with the Guardian service up
and `GUARDIAN_URL` set), and the Approvals flow.

**Run locally if you want them** (need `miden-client` + the operator keystore):
the autonomous agent loop (`cd agent && npm start`), `redeem-service` (point
`VITE_REDEEM_ENDPOINT` at it), and `fund-service`.
