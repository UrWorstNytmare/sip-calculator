// scripts/matchRatios.js
// Matches AMFI TER records (data/ter_raw.json) to our funds (data/funds.json)
// by normalized scheme name, since TER has no shared ID with our scheme codes.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const funds = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'funds.json'), 'utf-8'));
const terRecords = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ter_raw.json'), 'utf-8'));

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const terMap = new Map();
for (const rec of terRecords) terMap.set(normalize(rec.Scheme_Name), rec);

const result = {};
let matched = 0;
const unmatched = new Set();

for (const fund of funds) {
  const rec = terMap.get(normalize(fund.schemeName));
  if (!rec) { unmatched.add(fund.schemeName); continue; }

  const isDirect = (fund.plan || '').toLowerCase().includes('direct');
  const ter = isDirect ? rec.D_TER : rec.R_TER;
  if (ter == null) continue;

  result[fund.schemeCode] = { expenseRatio: parseFloat(ter), terMonth: rec.Month };
  matched++;
}

fs.writeFileSync(path.join(DATA_DIR, 'expense_ratio.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'unmatched_names.json'), JSON.stringify([...unmatched], null, 2));

console.log(`Matched ${matched} of ${funds.length} fund rows`);
console.log(`${unmatched.size} distinct scheme names unmatched (see data/unmatched_names.json)`);