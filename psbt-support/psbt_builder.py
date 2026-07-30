"""
PSBT Builder (Python)

Fetches a bump plan from FastPath and constructs an unsigned PSBT file.

Usage:
  EVM_PRIVATE_KEY=0x... python psbt-support/psbt_builder.py <txid> [target_sat_vb]
"""

import os
import sys
import json
import base64
import requests

API_BASE = os.getenv("FASTPATH_API_BASE", "https://api.nativebtc.org")

if len(sys.argv) < 2:
    print("Usage: python psbt-support/psbt_builder.py <txid> [target_sat_vb]")
    sys.exit(1)

txid = sys.argv[1]
target_sat_vb = int(sys.argv[2]) if len(sys.argv) > 2 else 25
private_key = os.getenv("EVM_PRIVATE_KEY")

if not private_key:
    print("Set EVM_PRIVATE_KEY to a bot wallet funded with USDC.")
    sys.exit(1)

def get_bump_plan(txid, target_sat_vb):
    url = f"{API_BASE}/v1/template/bump-plan"
    payload = {"txid": txid, "targetSatVb": target_sat_vb}
    headers = {"content-type": "application/json"}
    
    # Probe or execute request
    res = requests.post(url, json=payload, headers=headers)
    
    if res.status_code == 402:
        print("Payment required. Use x402 client wrapper or node environment for automated payment.")
        sys.exit(1)
        
    if not res.ok:
        print(f"API Error {res.status_code}: {res.text}")
        sys.exit(1)
        
    return res.json()

def main():
    print(f"Fetching bump plan for {txid}...")
    data = get_bump_plan(txid, target_sat_vb)
    
    bump = data.get("bump", {})
    if not bump.get("available"):
        print(f"No bump plan available for {txid}.")
        return

    psbt_b64 = bump.get("psbtBase64") or data.get("psbtBase64")
    
    if not psbt_b64:
        print("Error: Bump plan returned no raw PSBT data.")
        sys.exit(1)
        
    filename = "bump_replacement.psbt"
    with open(filename, "w") as f:
        f.write(psbt_b64)
        
    print(f"\n✅ Unsigned PSBT saved to {filename}")

if __name__ == "__main__":
    main()
