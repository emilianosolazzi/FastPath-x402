import express from "express";
import { createFastPathX402Client, getX402Quote } from "./x402-optimizer-middleware.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTML Control Panel
app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FastPath x402 Control Panel</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
        .container { max-width: 700px; margin: 0 auto; background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; }
        label { font-size: 0.875rem; font-weight: 600; color: #94a3b8; display: block; margin-top: 1rem; }
        input, select { width: 100%; padding: 0.75rem; margin-top: 0.25rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box; }
        button { margin-top: 1.5rem; width: 100%; padding: 0.875rem; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
        button:hover { background: #0369a1; }
        pre { background: #0f172a; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #4ade80; font-size: 0.85rem; border: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>⚡ FastPath x402 Operator Console</h1>
        <form id="runnerForm">
          <label>EVM Private Key (funded with USDC)</label>
          <input type="password" id="privateKey" placeholder="0x..." required />

          <label>API Action</label>
          <select id="action">
            <option value="quote">Free Quote Preview ($0.00)</option>
            <option value="feeLadder">Fee Ladder ($0.01)</option>
            <option value="optimizer">Optimized Block Template ($0.05)</option>
          </select>

          <button type="submit">Execute Request</button>
        </form>

        <label>Response Output</label>
        <pre id="output">Waiting for execution...</pre>
      </div>

      <script>
        document.getElementById('runnerForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const output = document.getElementById('output');
          output.textContent = "Executing request via x402...";

          const privateKey = document.getElementById('privateKey').value;
          const action = document.getElementById('action').value;

          try {
            const res = await fetch('/api/run', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ privateKey, action })
            });
            const data = await res.json();
            output.textContent = JSON.stringify(data, null, 2);
          } catch (err) {
            output.textContent = "Error: " + err.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// API Execution Endpoint
app.post("/api/run", async (req, res) => {
  const { privateKey, action } = req.body;
  const apiBase = process.env.FASTPATH_API_BASE || "https://api.nativebtc.org";

  try {
    if (action === "quote") {
      const quote = await getX402Quote({ apiBase, path: "/v1/template/optimized-txids", method: "POST" });
      return res.json(quote);
    }

    if (!privateKey) {
      return res.status(400).json({ error: "Private key required for paid actions." });
    }

    const client = createFastPathX402Client({ apiBase, privateKey });

    if (action === "feeLadder") {
      const result = await client.feeLadder(6);
      return res.json(result);
    }

    if (action === "optimizer") {
      const result = await client.post("/v1/template/optimized-txids", {});
      return res.json(result);
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 FastPath Web Console running at http://localhost:${PORT}`);
});
