# scripts/fetch_ratios.py
# Uses AMFI's monthly TER Excel (all schemes, one row per scheme per day).
# Keeps the newest row per scheme and writes data/ter_raw.json.
# Reads this month + last month so the 1st of a month is never empty.

import io, json, os
from datetime import date
import openpyxl
from amfipy import AMFIClient

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)
TER_FILE = os.path.join(OUT_DIR, "ter_raw.json")
client = AMFIClient()

today = date.today()
cur = f"{today.month:02d}-{today.year}"
py, pm = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
prev = f"{pm:02d}-{py}"

latest = {}
for month in [prev, cur]:
    try:
        data = client.ter.download_excel(month=month)
    except Exception as e:
        print(f"Skipped {month}: {e}")
        continue

    ws = openpyxl.load_workbook(io.BytesIO(data), read_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h else "" for h in next(rows)]
    i_code = header.index("NSDL Scheme Code")
    i_name = header.index("Scheme Name")
    i_cat = header.index("Scheme Category")
    i_date = header.index("TER Date")
    i_reg = header.index("Regular Plan - Total TER (%)")
    i_dir = header.index("Direct Plan - Total TER (%)")

    width = max(i_code, i_name, i_cat, i_date, i_reg, i_dir) + 1
    count = 0
    for r in rows:
        r = list(r) + [None] * (width - len(r))  # pad short/blank rows
        if not r[i_code] or not r[i_date]:
            continue
        d = r[i_date]
        iso = d.isoformat() if hasattr(d, "isoformat") else str(d)
        old = latest.get(r[i_code])
        if not old or iso > old["TER_Date"]:
            latest[r[i_code]] = {
                "NSDLSchemeCode": r[i_code],
                "Scheme_Name": r[i_name],
                "SchemeCat_Desc": r[i_cat],
                "TER_Date": iso,
                "R_TER": r[i_reg],
                "D_TER": r[i_dir],
                "Month": month,
            }
        count += 1
    print(f"{month}: read {count} rows")

all_ter = list(latest.values())
json.dump(all_ter, open(TER_FILE, "w"), indent=2)
print(f"Saved {len(all_ter)} schemes with latest TER")
if all_ter:
    print("SAMPLE RECORD:", all_ter[0])