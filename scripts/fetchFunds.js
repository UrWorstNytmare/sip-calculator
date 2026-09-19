const fs = require('fs');
const path = require('path');

async function fetchFunds() {
  const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
  const text = await res.text();
  const lines = text.split('\n');

  const funds = [];
  let currentAMC = '';
  let currentCategory = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.includes(';')) {
      const parts = line.split(';');
      if (parts.length >= 8) {
        const [schemeCode, isinPayout, isinReinvest, schemeName, plan, option, nav, date] = parts;
        if (schemeCode === 'Scheme Code') continue; // header row
        funds.push({
          schemeCode: schemeCode.trim(),
          isinPayout: isinPayout.trim(),
          isinReinvest: isinReinvest.trim(),
          schemeName: schemeName.trim(),
          plan: plan.trim(),
          option: option.trim(),
          nav: parseFloat(nav) || null,
          date: (date || '').trim(),
          amc: currentAMC,
          category: currentCategory
        });
      }
    } else if (line.toLowerCase().includes('scheme')) {
      currentCategory = line;
    } else {
      currentAMC = line;
    }
  }

  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'funds.json'), JSON.stringify(funds, null, 2));
  console.log(`Saved ${funds.length} funds to data/funds.json`);
}

fetchFunds().catch(err => {
  console.error('Failed to fetch funds:', err);
  process.exit(1);
});
