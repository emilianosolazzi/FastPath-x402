# FastPath x402 Demo

Minimal public Node.js examples for paying FastPath x402 endpoints and reading Bitcoin intelligence data.

Live API: [api.nativebtc.org/x402](https://api.nativebtc.org/x402)

## What this repo contains

- `quickstart.js` — one file, one command, live Bitcoin tx analysis paid with USDC
- `x402-optimizer-middleware.js` — reusable x402 client factory
- `test-x402-optimizer.js` — full demo: quote check, fee ladder, tx insight
- `package.json`
- `.gitignore`

## Install

```bash
npm install
```

## Quickstart — 60 seconds

The fastest way to see x402 + Bitcoin working together. Grabs a live unconfirmed transaction automatically, pays $0.01 USDC on Base, returns a decision.

```powershell
$env:EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
node quickstart.js
```

```bash
EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY node quickstart.js
```

Expected output:

```
Analyzing 81c97a6c...38325
Verdict:  healthy_for_target
Summary:  Effective fee rate 2 sat/vB is at or above the current 1 sat/vB target.
Bump:     not needed
Cost:     $0.01 USDC on Base
```

Use a low-balance bot wallet. Do not use your main wallet.

## Free quote — no wallet needed

See the payment challenge before spending anything.

```bash
npm run quote
```

Calls `GET /v1/block-height` and prints the `Payment-Required` header decoded — price, supported networks, USDC token address, and pay-to address.

## Full demo

Fee ladder across all block targets, plus optional tx insight.

PowerShell:

```powershell
$env:EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
npm run test:x402
```

Bash:

```bash
EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY npm run test:x402
```

To also run tx insight, set a txid. Get one from [mempool.space](https://mempool.space) or let quickstart.js grab one automatically:

```powershell
$env:TXID="PASTE_TXID"
npm run test:x402
```

The full demo calls `fastpath_feeLadder` then optionally `fastpath_bitcoinInsight`.

## Supported payment networks

| Network | CAIP-2 |
| --- | --- |
| Base | `eip155:8453` |
| Polygon | `eip155:137` |
| Arbitrum | `eip155:42161` |
| World | `eip155:480` |

`eip155:*` in the client config means the library picks whichever network the wallet has funds on.

## Pricing

| Route | USDC per request |
| --- | --- |
| `/v1/block-height`, `/v1/rpc`, `/v1/mempool/*` | $0.001 |
| `/v1/utxos/:address` | $0.002 |
| `/v1/mempool/stream-ticket` | $0.005 |
| `/v1/bitcoin/insight`, `/v1/template/*` | $0.01 |
| `/v1/template/batch-check` | $0.05 |

Full pricing and capabilities: `curl https://api.nativebtc.org/v1/template/capabilities`

## How it works

1. Bot calls a paid route
2. Server returns `HTTP 402 Payment Required` with a `Payment-Required` header
3. `@x402/fetch` reads the header, pays USDC on-chain automatically
4. Bot retries the request with a payment proof header
5. Server verifies via Coinbase CDP facilitator and returns Bitcoin data

No API keys. No accounts. No human involvement after the wallet is funded.
