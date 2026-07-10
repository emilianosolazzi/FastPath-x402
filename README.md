# FastPath x402 Demo

Minimal public Node.js examples for paying FastPath x402 endpoints and reading Bitcoin optimizer data.

This repo is intentionally small. It contains only:

- `x402-optimizer-middleware.js`
- `test-x402-optimizer.js`
- `package.json`
- `README.md`
- `.gitignore`

## What This Demonstrates

- Reading an x402 quote before a bot spends.
- Creating an x402-paid FastPath client.
- Calling `fastpath_feeLadder` through `POST /v1/rpc`.
- Optionally calling `/v1/bitcoin/insight` for a Bitcoin txid.

Customer access is x402 only. No customer API key is used.

## Install

```bash
npm install
```

## Free Quote Test

This does not require a wallet and does not spend.

```bash
npm run quote
```

It calls:

```text
GET https://api.nativebtc.org/v1/block-height
```

The expected result is `HTTP 402 Payment Required` with `Payment-Required` options for USDC on supported x402 networks.

## Paid Test

Use a low-balance bot wallet. Do not use your main wallet.

PowerShell:

```powershell
$env:EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
$env:X402_NETWORK="eip155:*"
npm run test:x402
```

Bash:

```bash
EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY X402_NETWORK=eip155:* npm run test:x402
```

The paid test calls:

```js
fastPath.feeLadder(6)
```

To test tx insight:

```powershell
$env:TXID="PASTE_TXID"
npm run test:x402
```

## Supported Payment Networks

FastPath currently advertises USDC payment options for:

| Network | CAIP-2 |
| --- | --- |
| Base | `eip155:8453` |
| Polygon | `eip155:137` |
| Arbitrum | `eip155:42161` |
| World | `eip155:480` |

## Publish From A Clean Folder

From `C:\FastPath-x402-demo`:

```powershell
git init
echo ".env" > .gitignore
echo "node_modules/" >> .gitignore
git add .
git commit -m "FastPath x402 integration examples"
git branch -M main
git remote add origin https://github.com/emilianosolazzi/FastPath-x402.git
git pull origin main --rebase
git push -u origin main
```


