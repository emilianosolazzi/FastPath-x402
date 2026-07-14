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
