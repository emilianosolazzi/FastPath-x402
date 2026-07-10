import "dotenv/config";
import { createFastPathX402Client, getX402Quote } from "./x402-optimizer-middleware.js";

function print(title, value) {
  console.log(`\n${title}`);
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const apiBase = process.env.FASTPATH_API_BASE || "https://api.nativebtc.org";
  const targetBlocks = Number(process.env.TARGET_BLOCKS || 6);

  const quote = await getX402Quote({ apiBase, path: "/v1/block-height" });
  print("x402 quote for GET /v1/block-height", {
    status: quote.status,
    resource: quote.paymentRequired?.resource,
    accepts: quote.paymentRequired?.accepts?.map((item) => ({
      network: item.network,
      amountAtomicUsdc: item.amount,
      asset: item.asset,
      payTo: item.payTo
    }))
  });

  if (!process.env.EVM_PRIVATE_KEY) {
    console.log("\nNo EVM_PRIVATE_KEY set, so paid calls were skipped.");
    console.log("Set EVM_PRIVATE_KEY to a low-balance bot wallet funded with USDC, then run this again.");
    return;
  }

  const fastPath = createFastPathX402Client({
    apiBase,
    privateKey: process.env.EVM_PRIVATE_KEY,
    network: process.env.X402_NETWORK || "eip155:*"
  });

  const feeLadder = await fastPath.feeLadder(targetBlocks);
  print("fastpath_feeLadder", feeLadder.data);

  if (process.env.TXID) {
    const insight = await fastPath.bitcoinInsight({
      txid: process.env.TXID,
      targetBlocks,
      action: "analyze"
    });
    print("bitcoinInsight", insight.data);
  } else {
    console.log("\nSet TXID to test /v1/bitcoin/insight.");
  }
}

main().catch((error) => {
  console.error("\nTest failed");
  console.error(error?.message || error);
  process.exitCode = 1;
});
