import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function calcCAGR(startNav, endNav, years) {
  if (!startNav || !endNav || years <= 0) return null;
  return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
}

function findNavMonthsAgo(history, months) {
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() - months);
  return history.find(h => new Date(h.date.split('-').reverse().join('-')) <= targetDate);
}

function getExpenseRatio(schemeCode) {
  try {
    const filePath = path.join(process.cwd(), 'data', 'expense_ratio.json');
    const map = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return map[schemeCode]?.expenseRatio ?? null;
  } catch {
    return null;
  }
}

export async function GET(request, context) {
  const { code } = await context.params;
  const res = await fetch(`https://api.mfapi.in/mf/${code}`);
  if (!res.ok) {
    return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
  }
  const data = await res.json();
  const history = data.data;
  const latestNav = parseFloat(history[0]?.nav);

  const cagr = { sixMonth: null, oneYear: null, threeYear: null, fiveYear: null };
  const periods = [
    { key: 'sixMonth', months: 6, years: 0.5 },
    { key: 'oneYear', months: 12, years: 1 },
    { key: 'threeYear', months: 36, years: 3 },
    { key: 'fiveYear', months: 60, years: 5 }
  ];
  for (const p of periods) {
    const past = findNavMonthsAgo(history, p.months);
    if (past) cagr[p.key] = calcCAGR(parseFloat(past.nav), latestNav, p.years);
  }

  return NextResponse.json({
    schemeCode: code,
    schemeName: data.meta?.scheme_name,
    fundHouse: data.meta?.fund_house,
    schemeType: data.meta?.scheme_type,
    schemeCategory: data.meta?.scheme_category,
    latestNav,
    latestDate: history[0]?.date,
    expenseRatio: getExpenseRatio(code),
    cagr,
    history
  });
}