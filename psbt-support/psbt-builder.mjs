/**
 * PSBT Builder (Node.js)
 *
 * Fetches a bump plan from FastPath and constructs an unsigned PSBT
 * ready for wallet signing (Sparrow, Electrum, Bitcoin Core).
 *
 * Usage:
 *   EVM_PRIVATE_KEY=0x... node psbt-support/psbt-builder.mjs <txid> [targetSatVb]
 */

import { writeFileSync } from "fs";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { createFastPathX402Client } from "../x402-optimizer-middleware.js";

bitcoin.initEccLib(ecc);

const txid = process.argv[2];
const targetSatVb = Number(process.argv[3] || 25);

if (!txid) {
  console.error("Usage: node psbt-support/psbt-builder.mjs <txid> [targetSatVb]");
  process.exit(1);
}

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("Set EVM_PRIVATE_KEY to a bot wallet funded with USDC.");
  process.exit(1);
}

async function buildPsbt() {
  console.log(`Fetching bump plan for ${txid} (Target: ${targetSatVb} sat/vB)...`);

  const client = createFastPathX402Client({
    apiBase: process.env.FASTPATH_API_BASE || "https://api.nativebtc.org",
    privateKey: process.env.EVM_PRIVATE_KEY,
  });

  const res = await client.bumpPlan(txid, targetSatVb);
  const data = res.data;

  if (!data?.bump?.available) {
    console.log(`\nNo bump plan available for ${txid}.`);
    console.log(`Reason: ${data?.reason || "Transaction does not require or support RBF/CPFP."}`);
    return;
  }

  const inputDetails = data.inputDetails || data.bump?.inputDetails;

  if (!inputDetails || inputDetails.length === 0) {
    console.error("\nError: Node response missing inputDetails required to build PSBT.");
    console.error("Node must have txindex=1 enabled to resolve parent UTXOs.");
    process.exit(1);
  }

  console.log("\nConstructing unsigned PSBT...");

  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });

  // Add inputs from resolved details
  for (const input of inputDetails) {
    const inputData = {
      hash: input.txid,
      index: input.vout,
    };

    if (input.nonWitnessUtxo) {
      inputData.nonWitnessUtxo = Buffer.from(input.nonWitnessUtxo, "hex");
    } else if (input.witnessUtxo) {
      inputData.witnessUtxo = {
        script: Buffer.from(input.witnessUtxo.scriptHex, "hex"),
        value: BigInt(input.witnessUtxo.value),
      };
    }

    psbt.addInput(inputData);
  }

  // Add outputs specified in the bump plan
  const outputs = data.bump?.outputs || [];
  for (const output of outputs) {
    psbt.addOutput({
      address: output.address,
      value: BigInt(output.valueSats),
    });
  }

  const psbtBase64 = psbt.toBase64();
  const filename = "bump_replacement.psbt";

  writeFileSync(filename, psbtBase64);

  console.log("\n✅ Unsigned PSBT created successfully!");
  console.log(`Saved to: ${filename}`);
  console.log("\nImport this file into Sparrow, Electrum, or Bitcoin Core to sign and broadcast.");
}

buildPsbt().catch((err) => {
  console.error("\nPSBT construction failed:", err.message || err);
  process.exit(1);
});
