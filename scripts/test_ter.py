# scripts/test_ter.py  (diagnostic only - prints results, saves nothing)
import io
from amfipy import AMFIClient

client = AMFIClient()
MONTH = "10-2026"

# A) Excel download (all AMCs) - does it hold the full list?
try:
    data = client.ter.download_excel(month=MONTH)
    print("EXCEL bytes:", len(data))
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True)
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        print("SHEET", ws.title, "rows:", len(rows))
        for r in rows[:4]:
            print(r)
except Exception as e:
    print("EXCEL failed:", e)

# B) JSON: all AMCs in one call
try:
    print("JSON all AMCs:", len(client.ter.fetch(month=MONTH)))
except Exception as e:
    print("JSON all failed:", e)

# C) JSON: Axis (53) split by category - does filtering return more rows?
for cat in ["-1", "Equity Scheme", "Debt Scheme", "Hybrid Scheme", "Other Scheme", "Solution Oriented Scheme"]:
    try:
        print("JSON Axis", cat, len(client.ter.fetch(month=MONTH, mf_id=53, category=cat)))
    except Exception as e:
        print("JSON Axis", cat, "failed:", e)