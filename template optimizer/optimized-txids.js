import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const API = "https://api.nativebtc.org";

// ── Validate environment ─────────────────────────────────────────
if (!process.env.EVM_PRIVATE_KEY) {
  console.error("Set EVM_PRIVATE_KEY to a bot wallet funded with USDC.");
  console.error("");
  console.error("  bash:        EVM_PRIVATE_KEY=0x... node optimized-txids.mjs");
  console.error("  PowerShell:  $env:EVM_PRIVATE_KEY='0x...' ; node optimized-txids.mjs");
  console.error("");
  console.error("Wallet needs USDC on Base (eip155:8453), Polygon (eip155:137),");
  console.error("Arbitrum (eip155:42161), or World (eip155:480).");
  process.exit(1);
}

const key = process.env.EVM_PRIVATE_KEY.startsWith("0x")
  ? process.env.EVM_PRIVATE_KEY
  : `0x${process.env.EVM_PRIVATE_KEY}`;

const account = privateKeyToAccount(key);

// ── x402 client ──────────────────────────────────────────────────
const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
});

// ── Optional: preview the 402 quote before spending ─────────────
const SHOW_QUOTE = process.env.QUOTE_ONLY === "true";

if (SHOW_QUOTE) {
  console.log("Fetching x402 quote (free — no payment)...\n");
  const probe = await fetch(`${API}/v1/template/optimized-txids`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  const header =
    probe.headers.get("PAYMENT-REQUIRED") ||
    probe.headers.get("payment-required");

  if (header) {
    try {
      const challenge = JSON.parse(
        Buffer.from(header, "base64").toString("utf8")
      );
      console.log("Payment challenge:");
      console.log(`  Price:    $${parseInt(challenge.accepts?.[0]?.amount ?? 50000) / 1_000_000} USDC`);
      console.log(`  Networks: ${challenge.accepts?.map((a) => a.network).join(", ")}`);
      console.log(`  Pay to:   ${challenge.accepts?.[0]?.payTo}`);
      console.log(`  Resource: ${challenge.resource?.url}`);
      console.log(`\nRun without QUOTE_ONLY=true to pay and fetch.`);
    } catch {
      console.log("Raw Payment-Required header:", header.slice(0, 100) + "...");
    }
  } else {
    console.log("No payment challenge received. Status:", probe.status);
  }
  process.exit(0);
}

// ── Paid call ────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════╗");
console.log("║  FastPath Optimized Txids                    ║");
console.log(`║  Wallet: ${account.address.slice(0, 20)}...        ║`);
console.log("║  Cost:   $0.05 USDC                          ║");
console.log("╚══════════════════════════════════════════════╝");
console.log("");
console.log("Paying $0.05 USDC via x402...");

const startMs = Date.now();

let res;
try {
  res = await pay(`${API}/v1/template/optimized-txids`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
} catch (err) {
  console.error("\nRequest failed:", err.message);
  if (err.message.includes("insufficient") || err.message.includes("revert")) {
    console.error("\nWallet may have insufficient USDC.");
    console.error(`Check balance: https://basescan.org/address/${account.address}`);
  }
  process.exit(1);
}

const elapsed = Date.now() - startMs;

if (!res.ok) {
  const body = await res.text();
  console.error(`\nHTTP ${res.status}: ${body}`);
  process.exit(1);
}

const data = await res.json();

// ── Display results ───────────────────────────────────────────────
console.log(`\n✅ Payment confirmed (${elapsed}ms total)\n`);

console.log("═══════════════════════════════════════════════");
console.log(" Block Template");
console.log("═══════════════════════════════════════════════");
console.log(`  Height:          ${data.height}`);
console.log(`  Txid count:      ${data.txCount} / 4000`);
console.log(`  Coinbase value:  ${data.coinbaseValue} sats`);
console.log(`                   (${(data.coinbaseValue / 1e8).toFixed(8)} BTC)`);
console.log(`  Mempool size:    ${data.mempoolSize?.toLocaleString() ?? "?"} txs`);

console.log("\n═══════════════════════════════════════════════");
console.log(" Optimizer vs Core Baseline");
console.log("═══════════════════════════════════════════════");
console.log(`  Optimized fees:  ${data.optimizedFeeSats?.toLocaleString() ?? "?"} sats`);
console.log(`  Baseline fees:   ${data.baselineFeeSats?.toLocaleString() ?? "?"} sats`);
console.log(`  Fee delta:       +${data.feeDeltaSats?.toLocaleString() ?? "?"} sats`);
console.log(`  Uplift:          ${data.upliftBps} bps`);
console.log(`  Optimizer-only:  ${data.optimizerOnlyCount} txids Core missed`);
console.log(`  Same tip:        ${data.sameTip}`);

if (data.receipt) {
  console.log("\n═══════════════════════════════════════════════");
  console.log(" Signed Receipt");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Algorithm:  ${data.receipt.alg}`);
  console.log(`  Key ID:     ${data.receipt.keyId}`);
  console.log(`  Present:    ${data.receipt.present}`);
}

// ── Txid list ────────────────────────────────────────────────────
const SHOW_TXIDS = process.env.SHOW_TXIDS !== "false";

if (SHOW_TXIDS && data.txids?.length > 0) {
  console.log("\n═══════════════════════════════════════════════");
  console.log(` Txids (first 10 of ${data.txids.length})`);
  console.log("═══════════════════════════════════════════════");
  data.txids.slice(0, 10).forEach((txid, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${txid}`);
  });
  if (data.txids.length > 10) {
    console.log(`  ... ${data.txids.length - 10} more`);
  }
}

// ── Stratum V2 usage guide ────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log(" Stratum V2 Job Declaration");
console.log("═══════════════════════════════════════════════");
console.log(`
  This txid list is ready for Job Declaration submission.

  Compatible pools (as of July 2026):
    DMND   — first pool with JD in production (block 955,318)
    Braiins Pool — full V2 with JD
    OCEAN  — via DATUM protocol

  Flow:
    1. Validate txids against your local mempool
    2. Build coinbase tx using coinbaseValue: ${data.coinbaseValue}
    3. Submit template to your pool via Job Declaration
    4. Pool validates and mines with your optimized template

  Uplift this cycle: +${data.feeDeltaSats?.toLocaleString() ?? 0} sats over Core baseline
`);

// ── Save to file if requested ─────────────────────────────────────
if (process.env.SAVE_OUTPUT === "true") {
  const { writeFileSync } = await import("fs");
  const filename = `optimized-template-${data.height}.json`;
  writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`💾 Full response saved to ${filename}`);
}
