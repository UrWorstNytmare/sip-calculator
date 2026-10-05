# scripts/fetch_ratios.py
# AMFI only re-publishes a scheme's TER when it CHANGES, not every month.
# So: first run backfills ~2 years (covers most schemes), every run after
# that just merges in the current month's new filings on top of the saved file.

import json, os, time
from datetime import date
from amfipy import AMFIClient

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)
TER_FILE = os.path.join(OUT_DIR, "ter_raw.json")
client = AMFIClient()

# 1) Full AMC ID list
amc_list = client.fund_performance.filters()["mutualFundList"]
json.dump(amc_list, open(os.path.join(OUT_DIR, "amc_list.json"), "w"), indent=2)
print(f"Saved {len(amc_list)} AMCs")

# 2) Load whatever we already saved before (key = NSDLSchemeCode)
latest = {}
if os.path.exists(TER_FILE):
    for rec in json.load(open(TER_FILE)):
        if rec.get("NSDLSchemeCode"):
            latest[rec["NSDLSchemeCode"]] = rec
first_run = len(latest) == 0

# 3) Decide which months to pull
today = date.today()
this_fy = f"{today.year}-{today.year+1}" if today.month >= 4 else f"{today.year-1}-{today.year}"

if first_run:
    prev_fy = f"{int(this_fy[:4]) - 1}-{this_fy[:4]}"
    months = []
    for fy in [this_fy, prev_fy]:
        try:
            months += client.ter.months(year=fy)
        except Exception as e:
            print(f"Could not list months for {fy}: {e}")
    print(f"First run: backfilling {len(months)} months (this may take a while)")
else:
    months = [f"{today.month:02d}-{today.year}"]
    print("Incremental run: current month only")

# 4) Pull + keep the newest record per scheme
for amc in amc_list:
    for m in months:
        try:
            records = client.ter.fetch(month=m, mf_id=amc["id"])
        except Exception as e:
            print(f"Skipped {amc['name']} {m}: {e}")
            continue
        for rec in records:
            key = rec.get("NSDLSchemeCode")
            if not key:
                continue
            existing = latest.get(key)
            if not existing or rec["TER_Date"] > existing["TER_Date"]:
                latest[key] = rec
        time.sleep(0.2)  # be polite to AMFI's server

all_ter = list(latest.values())
json.dump(all_ter, open(TER_FILE, "w"), indent=2)
print(f"Saved {len(all_ter)} total schemes with known TER")

if all_ter:
    print("SAMPLE KEYS:", list(all_ter[0].keys()))
    print("SAMPLE RECORD:", all_ter[0])