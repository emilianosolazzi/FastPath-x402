/**
 * FastPath x402 Quickstart
 *
 * Grabs a live unconfirmed Bitcoin transaction, verifies it is genuinely
 * unconfirmed using FREE calls first, then pays $0.01 USDC via x402
 * exactly once for the analysis.
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

/**
 * FREE check — is this txid still unconfirmed right now?
 * Uses mempool.space's public API. Costs nothing.
 * Returns true only if the tx exists AND is not yet confirmed.
 */
async function isUnconfirmed(txid) {
  try {
    const res = await fetch(`https://mempool.space/api/tx/${txid}/status`);
    if (!res.ok) return false;
    const status = await res.json();
    return status.confirmed === false;
  } catch {
    return false;
  }
}

/**
 * Find a genuinely unconfirmed txid. All calls in here are FREE.
 * Picks random candidates from the mempool list and verifies each
 * one is still unconfirmed before returning it. Never returns a
 * txid that hasn't passed live verification.
 */
async function findUnconfirmedTxid() {
  console.log("Fetching live mempool txid list (free)...");

  const txids = await fetch("https://mempool.space/api/mempool/txids")
    .then((r) => r.json())
    .catch(() => null);

  if (!txids || txids.length === 0) {
    return null;
  }

  // Try up to 5 random candidates. Random avoids repeatedly hitting
  // the same stuck transaction at a fixed list position.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const candidate = txids[Math.floor(Math.random() * txids.length)];
    process.stdout.write(`Verifying candidate ${attempt} is unconfirmed (free)... `);

    if (await isUnconfirmed(candidate)) {
      console.log("confirmed unconfirmed ✓");
      return candidate;
    }
    console.log("already confirmed, trying another");
  }

  return null;
}

// ── Resolve the txid ────────────────────────────────────────────
let txid = process.env.TXID;

if (txid) {
  // Even a user-supplied txid gets the free check first —
  // no payment for a transaction that already confirmed.
  console.log("Verifying supplied TXID is unconfirmed (free)...");
  if (!(await isUnconfirmed(txid))) {
    console.error(`\nTXID ${txid} is already confirmed or unknown.`);
    console.error("No payment was made. Unset TXID to auto-select a live one:");
    console.error("  PowerShell: Remove-Item Env:TXID");
    console.error("  Bash:       unset TXID");
    process.exit(1);
  }
} else {
  txid = await findUnconfirmedTxid();
  if (!txid) {
    console.error("\nCould not find a verified unconfirmed txid after 5 attempts.");
    console.error("No payment was made. Try again in a moment.");
    process.exit(1);
  }
}

// ── Pay exactly once, for a verified-unconfirmed transaction ────
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
