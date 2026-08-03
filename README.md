# FastPath x402 Demo

Node.js examples for paying FastPath x402 endpoints — Bitcoin fee intelligence, mempool monitoring, RBF bump plans, and Core v31 optimizer templates for Stratum V2 Job Declaration.

Live API: [api.nativebtc.org](https://api.nativebtc.org)

## What this repo contains

| File | What it does | Cost |
| --- | --- | --- |
| `quickstart.mjs` | Grab a live unconfirmed tx, pay, get a verdict | $0.01 |
| `optimized-txids.mjs` | Fetch the full Core v31 optimizer template — up to 4,000 txids for Stratum V2 Job Declaration | $0.05 |
| `bump-plan.mjs` | Get an RBF/CPFP bump plan for any stuck transaction | $0.01 |
| `mempool-bot.mjs` | Autonomous mempool monitor — streams live txs, flags stuck ones, fetches bump plans | $0.005 + $0.01/stuck tx |
| `test-x402-optimizer.js` | Full demo: quote check, fee ladder, tx insight | $0.01 |
| `test-miner-optimizer.mjs` | Miner verification pipeline for Stratum V2 JD templates | $0.05 |
| `x402-optimizer-middleware.js` | Reusable x402 client factory used by all scripts | — |
| `server.js` | Web dashboard to execute x402 requests locally | — |
| `psbt-support/psbt-builder.mjs` | Build an unsigned PSBT from a bump plan for wallet signing | $0.01 |
| `psbt-support/psbt_builder.py` | Same flow in Python | $0.01 |

## Install

```bash
npm install
```

Requires Node.js 20+. A bot wallet with USDC on Base, Polygon, Arbitrum, or World. Do not use your main wallet.

---

## Quickstart — 60 seconds

Grabs a live unconfirmed transaction automatically, verifies it is in the mempool, pays $0.01 USDC, returns a plain-English verdict.

```powershell
$env:EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
node quickstart.mjs
```

```bash
EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY node quickstart.mjs
```

Expected output:

```text
Analyzing 6b467afb...0f55e
Verdict:  bump_recommended
Summary:  Effective fee rate 0.3 sat/vB is below the current 1 sat/vB target.
Bump:     +5815 sats via rbf_signed_replacement to reach 2 sat/vB
Template: live_cached — in optimized template: false
Cost:     $0.01 USDC on Base
```

---

## Optimizer template — Stratum V2 Job Declaration

Fetches the current Core v31 optimized block template from the FastPath optimizer. Up to 4,000 txids in mining-priority order, Ed25519 signed, ready for Job Declaration submission.

```powershell
$env:EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
node optimized-txids.mjs
```

```bash
EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY node optimized-txids.mjs
```

Expected output:

```text
✅ Payment confirmed (8432ms total)

Block Template
  Height:          957942
  Txid count:      4000 / 4000
  Coinbase value:  313611191 sats (3.13611191 BTC)
  Mempool size:    29,983 txs

Optimizer vs Core Baseline
  Optimized fees:  961,152 sats
  Baseline fees:   954,451 sats
  Fee delta:       +6,701 sats
  Uplift:          70.21 bps
  Optimizer-only:  22 txids Core missed
  Same tip:        true

Signed Receipt
  Algorithm:  Ed25519
  Key ID:     08f55b7f4f76bd21
  Present:    true
```

### Options

```powershell
# Free quote preview — no payment
$env:QUOTE_ONLY="true"
$env:EVM_PRIVATE_KEY="0xYOUR_KEY"
node optimized-txids.mjs

# Paid call — $0.05 USDC
$env:EVM_PRIVATE_KEY="0xYOUR_KEY"
node optimized-txids.mjs

# Paid call + save full JSON to file
$env:EVM_PRIVATE_KEY="0xYOUR_KEY"
$env:SAVE_OUTPUT="true"
node optimized-txids.mjs
# Saves: optimized-template-{height}.json
```

### Compatible pools for Job Declaration

| Pool | Protocol | Status |
| --- | --- | --- |
| DMND | Stratum V2 JD | Live — first JD block in production (block 955,318) |
| Braiins Pool | Stratum V2 JD | Live |
| OCEAN | DATUM protocol | Live |

Uplift range across benchmark cycles: **70 – 1,017 bps** over Core baseline. Varies with mempool complexity. Every cycle is Ed25519 signed and independently verifiable.

---

## Miner Verification Suite

Simulates a Stratum V2 Job Declaration pool or miner validating an x402 optimized block template prior to hashing. Checks Ed25519 signatures, consensus constraints (≤ 4000 txs), coinbase math, and ensures positive fee uplift before clearing the job.

```powershell
# PowerShell
$env:EVM_PRIVATE_KEY="0xYOUR_BOT_KEY"
node test-miner-optimizer.mjs
```

```bash
# Bash
EVM_PRIVATE_KEY=0xYOUR_BOT_KEY node test-miner-optimizer.mjs
```

---

## Bump plan — RBF/CPFP fee acceleration

Get an exact fee bump plan for any stuck unconfirmed transaction.

```powershell
$env:EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
node bump-plan.mjs <txid> [targetSatVb]
```

```bash
EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY node bump-plan.mjs 592bc4bd... 3
```

To broadcast a pre-signed replacement after signing in your wallet:

```powershell
$env:SIGNED_HEX="02000000..."
node bump-plan.mjs <txid>
```

FastPath plans and relays only. Your wallet signs. The API never holds keys or funds.

---

## PSBT builder

Constructs an unsigned PSBT from the bump plan — import into Electrum, Sparrow, or Bitcoin Core for signing. Requires `inputDetails` in the API response (needs `txindex=1` on the FastPath node).

```bash
# Node.js
npm install bitcoinjs-lib tiny-secp256k1
EVM_PRIVATE_KEY=0x... node psbt-support/psbt-builder.mjs <txid> [targetSatVb]

# Python
pip install requests web3 eth-account python-bitcoinlib
EVM_PRIVATE_KEY=0x... python psbt-support/psbt_builder.py <txid> [target_sat_vb]
```

Saves `bump_replacement.psbt` — import into any PSBT-compatible wallet.

---

## Mempool bot

Autonomous monitor. Pays $0.005 once for a 10-minute WebSocket stream ticket, connects to the live Core v31 mempool stream, and watches every incoming transaction. Auto-renews the ticket before expiry.

```powershell
$env:EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
node mempool-bot.mjs
```

What it flags:
- Stuck transactions below 1 sat/vB with RBF available → fetches bump plan automatically
- High-value fee arrivals above 50,000 sats
- RBF replacements as they happen

```powershell
# Tune thresholds
$env:MIN_FEE_RATE="2"           # Flag below 2 sat/vB (default: 1)
$env:HIGH_VALUE_SATS="100000"   # Flag above 100k sats (default: 50000)
$env:AUTO_INSIGHT="false"       # Watch only, no paid bump plans
```

---

## Web UI / Operator Console

A lightweight Express web dashboard to execute x402 requests visually without passing private keys through CLI environment variables. **For local testing only.**

```bash
npm run ui
```

Open `http://localhost:3000` in your browser. Paste your bot wallet private key into the form to securely run free quotes or paid template requests.

---

## Free quote — no wallet needed

See the payment challenge before spending anything.

```bash
npm run quote
```

Decodes the `Payment-Required` header — price, networks, USDC token address, pay-to address. Zero cost.

---

## All scripts

```bash
npm run start            # Run Web UI Console
npm run ui               # Run Web UI Console
npm run quote            # Free payment challenge preview
npm run test:x402        # Full demo: fee ladder + tx insight ($0.01)
npm run test:miner       # Miner template verification suite ($0.05)
npm run quickstart       # Live tx analysis ($0.01)
npm run optimized-txids  # Optimizer template for Job Declaration ($0.05)
npm run txids:quote      # Preview optimizer price, no payment
npm run txids:save       # Pay + save full JSON to file ($0.05)
npm run bump             # Bump plan for a txid ($0.01)
npm run mempool-bot      # Autonomous mempool monitor ($0.005 + $0.01/stuck tx)
npm run psbt             # Build unsigned PSBT ($0.01)
```

---

## Supported payment networks

| Network | CAIP-2 |
| --- | --- |
| Base | `eip155:8453` |
| Polygon | `eip155:137` |
| Arbitrum | `eip155:42161` |
| World | `eip155:480` |

`eip155:*` in the client config means the library pays on whichever network has funds.

## Pricing

| Route | USDC per request |
| --- | --- |
| `/v1/block-height`, `/v1/rpc`, `/v1/mempool/*` | $0.001 |
| `/v1/utxos/:address` | $0.002 |
| `/v1/mempool/stream-ticket` | $0.005 |
| `/v1/bitcoin/insight`, `/v1/template/check`, `/v1/template/fee-ladder`, `/v1/template/bump-plan` | $0.01 |
| `/v1/template/optimized-txids` | $0.05 |
| `/v1/template/batch-check` | $0.05 |

Full capabilities: `curl https://api.nativebtc.org/v1/template/capabilities`

## How it works

1. Bot calls a paid route
2. Server returns `HTTP 402 Payment Required` with a `Payment-Required` header
3. `@x402/fetch` reads the header, pays USDC on-chain automatically
4. Bot retries the request with a payment proof header
5. Server verifies via Coinbase CDP facilitator and returns Bitcoin data

No API keys. No accounts. No human involvement after the wallet is funded.
