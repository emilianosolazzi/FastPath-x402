/**
 * FastPath x402 Quickstart
 *
 * Grabs a live unconfirmed Bitcoin transaction automatically,
 * pays $0.01 USDC via x402, and returns a plain-English decision.
 *
 * Run:
 *   EVM_PRIVATE_KEY=0x... node quickstart.js        (bash)
 *   $env:EVM_PRIVATE_KEY="0x..." ; node quickstart.js  (PowerShell)
 *
 * Requirements:
 *   npm install
 *   A bot wallet with a small amount of USDC on Base, Polygon, Arbitrum, or World.
 *   Do not use your main wallet.
 */

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const API = "https://api.nativebtc.org";

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("Set EVM_PRIVATE_KEY to a bot wallet funded with USDC.");
  console.error("Example: EVM_PRIVATE_KEY=0x... node quickstart.js");
  process.exit(1);
}

const key = process.env.EVM_PRIVATE_KEY.startsWith("0x")
  ? process.env.EVM_PRIVATE_KEY
  : `0x${process.env.EVM_PRIVATE_KEY}`;

const account = privateKeyToAccount(key);

const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
});

// Use a txid from env, or grab a fresh unconfirmed one automatically
let txid = process.env.TXID;

if (!txid) {
  console.log("Fetching a live unconfirmed transaction from mempool.space...");
  const recent = await fetch("https://mempool.space/api/mempool/recent")
    .then((r) => r.json())
    .catch(() => null);

  if (!recent || !recent[0]?.txid) {
    console.error("Could not fetch a live txid. Set TXID manually and retry.");
    process.exit(1);
  }

  txid = recent[0].txid;
}

console.log(`\nAnalyzing ${txid}`);
console.log("Paying $0.01 USDC via x402...\n");

const res = await pay(`${API}/v1/bitcoin/insight`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    txid,
    targetBlocks: 6,
    action: "analyze",
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Request failed: HTTP ${res.status}`);
  console.error(body);
  process.exit(1);
}

const data = await res.json();

console.log(`Verdict:  ${data.verdict}`);
console.log(`Summary:  ${data.summary}`);

if (data.bump?.available) {
  console.log(
    `Bump:     +${data.bump.additionalFeeSats} sats via ${data.bump.method} to reach ${data.bump.targetSatVb} sat/vB`
  );
} else {
  console.log("Bump:     not needed");
}

if (data.templateCheck) {
  console.log(`Template: ${data.templateCheck.mode} — in optimized template: ${data.templateCheck.inOptimizedTemplate}`);
}

console.log(`\nCost:     $0.01 USDC`);
console.log(`Txid:     ${txid}`);
