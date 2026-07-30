# Free quote preview — no payment
$env:QUOTE_ONLY = "true"
$env:EVM_PRIVATE_KEY = "0xYOUR_KEY"
node optimized-txids.mjs

# Paid call — $0.05 USDC
$env:EVM_PRIVATE_KEY = "0xYOUR_KEY"
node optimized-txids.mjs

# Paid call + save full JSON to file
$env:EVM_PRIVATE_KEY = "0xYOUR_KEY"
$env:SAVE_OUTPUT = "true"
node optimized-txids.mjs

# PowerShell — Run miner template verification suite
$env:EVM_PRIVATE_KEY="0xYOUR_BOT_KEY"
node test-miner-optimizer.mjs

# Bash — Run miner template verification suite
EVM_PRIVATE_KEY=0xYOUR_BOT_KEY node test-miner-optimizer.mjs
