// quickstart.js
// npm i @x402/fetch @x402/evm viem
// EVM_PRIVATE_KEY=0x... node quickstart.js

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }]
});

// grab a live unconfirmed txid automatically
const [tx] = await fetch("https://mempool.space/api/mempool/recent")
  .then(r => r.json());

console.log(`Analyzing ${tx.txid}...`);

const res = await pay("https://api.nativebtc.org/v1/bitcoin/insight", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ txid: tx.txid, targetBlocks: 6, action: "analyze" })
}).then(r => r.json());

console.log(`Verdict:  ${res.verdict}`);
console.log(`Summary:  ${res.summary}`);
console.log(`Bump:     ${res.bump?.available ? `+${res.bump.additionalFeeSats} sats via ${res.bump.method}` : "not needed"}`);
console.log(`Cost:     $0.01 USDC on Base`);
