import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const DEFAULT_API_BASE = "https://api.nativebtc.org";

function trimSlash(value) {
  return String(value || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function parseJsonHeader(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error("Missing EVM_PRIVATE_KEY. Use a low-balance bot wallet funded with USDC on a supported x402 network.");
  }
  const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("EVM_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return normalized;
}

function decodePaymentResponse(value) {
  if (!value) return null;
  try {
    return decodePaymentResponseHeader(value);
  } catch {
    return parseJsonHeader(value);
  }
}

export async function getX402Quote({
  apiBase = DEFAULT_API_BASE,
  path = "/v1/block-height",
  method = "GET",
  body
} = {}) {
  const response = await fetch(`${trimSlash(apiBase)}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {})
  });

  return {
    status: response.status,
    body: await readBody(response),
    paymentRequired: parseJsonHeader(response.headers.get("payment-required"))
  };
}

export function createFastPathX402Client({
  apiBase = DEFAULT_API_BASE,
  privateKey = process.env.EVM_PRIVATE_KEY,
  network = process.env.X402_NETWORK || "eip155:*",
  fetchImpl = fetch
} = {}) {
  const account = privateKeyToAccount(normalizePrivateKey(privateKey));
  const paidFetch = wrapFetchWithPaymentFromConfig(fetchImpl, {
    schemes: [
      {
        network,
        client: new ExactEvmScheme(account)
      }
    ]
  });

  async function request(path, init = {}) {
    const response = await paidFetch(`${trimSlash(apiBase)}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.headers || {})
      }
    });

    const data = await readBody(response);
    const payment = decodePaymentResponse(response.headers.get("payment-response"));

    if (!response.ok) {
      const challenge = parseJsonHeader(response.headers.get("payment-required"));
      const message = [
        `FastPath request failed: HTTP ${response.status}`,
        typeof data === "string" ? data : JSON.stringify(data),
        challenge ? `Payment challenge: ${JSON.stringify(challenge)}` : ""
      ]
        .filter(Boolean)
        .join("\n");
      throw new Error(message);
    }

    return { data, payment, status: response.status };
  }

  async function post(path, payload) {
    return request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  }

  async function rpc(method, params = []) {
    return post("/v1/rpc", {
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    });
  }

  return {
    request,
    post,
    rpc,
    feeLadder: (targetBlocks = 6) => rpc("fastpath_feeLadder", [{ targetBlocks }]),
    templateCheck: (txid) => post("/v1/template/check", { txid }),
    batchCheck: (txids) => post("/v1/template/batch-check", { txids }),
    bumpPlan: (txid, targetSatVb = 25) => post("/v1/template/bump-plan", { txid, targetSatVb }),
    bitcoinInsight: (payload) => post("/v1/bitcoin/insight", payload),
    streamTicket: () => request("/v1/mempool/stream-ticket")
  };
}

export function fastPathOptimizerMiddleware(options = {}) {
  return function attachFastPath(req, _res, next) {
    req.fastPath = createFastPathX402Client(options);
    next();
  };
}
