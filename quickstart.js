/**
 * FastPath x402 Quickstart
 *
 * Finds a Bitcoin transaction that is verifiably in the FastPath node's
 * own mempool using FREE calls only, then pays $0.01 USDC via x402
 * exactly once for the analysis.
 *
 * Run:
 *   EVM_PRIVATE_KEY=0x... node quickstart.js        (bash)
 *   $env:EVM_PRIVATE_KEY="0x..." ; node quickstart.js  (PowerShell)
 */

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const API = "https://api.nativebtc.org";

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("Set EVM_PRIVATE_KEY to a bot wallet funded with USDC.");
  process.exit(1);
}

const key = process.env.EVM_PRIVATE_KEY.startsWith("0x")
  ? process.env.EVM_PRIVATE_KEY
  : `0x${process.env.EVM_PRIVATE_KEY}`;

const account = privateKeyToAccount(key);

const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
});

/** FREE — check the FastPath node's OWN mempool if the endpoint exists. */
async function fastpathHasTx(txid) {
  try {
    const res = await fetch(`${API}/v1/mempool/has/${txid}`);
    if (!res.ok) return null;            // endpoint not deployed yet
    const data = await res.json();
    return data.inMempool === true;
  } catch {
    return null;
  }
}

/** FREE — unconfirmed on mempool.space? */
async function unconfirmedOnMempoolSpace(txid) {
  try {
    const res = await fetch(`https://mempool.space/api/tx/${txid}/status`);
    if (!res.ok) return false;
    return (await res.json()).confirmed === false;
  } catch {
    return false;
  }
}

/** FREE — unconfirmed on blockstream.info (independent node)? */
async function unconfirmedOnBlockstream(txid) {
  try {
    const res = await fetch(`https://blockstream.info/api/tx/${txid}/status`);
    if (!res.ok) return false;
    return (await res.json()).confirmed === false;
  } catch {
    return false;
  }
}

/**
 * FREE verification pipeline. Preference order:
 *   1. FastPath's own /v1/mempool/has/:txid if deployed — authoritative
 *   2. Dual-source: unconfirmed on BOTH mempool.space and blockstream.info
 *      (two independent nodes agreeing means it has propagated widely)
 */
async function verifyTx(txid) {
  const direct = await fastpathHasTx(txid);
  if (direct !== null) return direct;   // authoritative answer from the target node

  const [ms, bs] = await Promise.all([
    unconfirmedOnMempoolSpace(txid),
    unconfirmedOnBlockstream(txid),
  ]);
  return ms && bs;
}

async function findVerifiedTxid() {
  console.log("Fetching live mempool txid list (free)...");
  const txids = await fetch("https://mempool.space/api/mempool/txids")
    .then((r) => r.json())
    .catch(() => null);

  if (!txids || txids.length === 0) return null;

  for (let attempt = 1; attempt <= 8; attempt++) {
    const candidate = txids[Math.floor(Math.random() * txids.length)];
    process.stdout.write(`Verifying candidate ${attempt} (free)... `);
    if (await verifyTx(candidate)) {
      console.log("verified ✓");
      return candidate;
    }
    console.log("not verified, trying another");
  }
  return null;
}

// ── Resolve and verify — all free ───────────────────────────────
let txid = process.env.TXID;

if (txid) {
  console.log("Verifying supplied TXID (free)...");
  if (!(await verifyTx(txid))) {
    console.error(`\nTXID not verified as unconfirmed. No payment was made.`);
    console.error("Unset TXID to auto-select: Remove-Item Env:TXID  (PowerShell)");
    process.exit(1);
  }
} else {
  txid = await findVerifiedTxid();
  if (!txid) {
    console.error("\nNo verified txid found after 8 attempts. No payment was made.");
    process.exit(1);
  }
}

// ── Pay exactly once ─────────────────────────────────────────────
console.log(`\nAnalyzing ${txid}`);
console.log("Paying $0.01 USDC via x402...\n");

const res = await pay(`${API}/v1/bitcoin/insight`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ txid, targetBlocks: 6, action: "analyze" }),
});

if (!res.ok) {
  console.error(`Request failed: HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();

console.log(`Verdict:  ${data.verdict}`);
console.log(`Summary:  ${data.summary}`);
console.log(
  data.bump?.available
    ? `Bump:     +${data.bump.additionalFeeSats} sats via ${data.bump.method} to reach ${data.bump.targetSatVb} sat/vB`
    : "Bump:     not needed"
);
if (data.templateCheck) {
  console.log(`Template: ${data.templateCheck.mode} — in optimized template: ${data.templateCheck.inOptimizedTemplate}`);
}
console.log(`\nCost:     $0.01 USDC`);
console.log(`Txid:     ${txid}`);
