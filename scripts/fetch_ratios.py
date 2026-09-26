# scripts/fetch_ratios.py
# Gets: (1) full AMC ID list  (2) expense ratio (TER) per AMC, from AMFI.
# Fixes the "MF_ID=All only returns 10 records" problem by looping AMC IDs.

import json, os
from datetime import date
from amfipy import AMFIClient

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)
client = AMFIClient()

# 1) Full AMC ID list
amc_list = client.fund_performance.filters()["mutualFundList"]  # [{id, name}, ...]
json.dump(amc_list, open(os.path.join(OUT_DIR, "amc_list.json"), "w"), indent=2)
print(f"Saved {len(amc_list)} AMCs")

# 2) TER for current month, looped per AMC
month_str = f"{date.today().month:02d}-{date.today().year}"
all_ter = []
for amc in amc_list:
    try:
        all_ter.extend(client.ter.fetch(month=month_str, mf_id=amc["id"]))
    except Exception as e:
        print(f"Skipped {amc['name']}: {e}")

json.dump(all_ter, open(os.path.join(OUT_DIR, "ter_raw.json"), "w"), indent=2)
print(f"Saved {len(all_ter)} TER records")

# 3) Print one real record so we know its exact field names before matching
if all_ter:
    print("SAMPLE KEYS:", list(all_ter[0].keys()))
    print("SAMPLE RECORD:", all_ter[0])