import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const funds = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'funds.json'), 'utf-8'));
  let ratios = {};
  try {
    ratios = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'expense_ratio.json'), 'utf-8'));
  } catch {}

  const lightList = funds.map(f => ({
    schemeCode: f.schemeCode,
    schemeName: f.schemeName,
    plan: f.plan,
    option: f.option,
    amc: f.amc,
    category: f.category,
    nav: f.nav,
    date: f.date,
    expenseRatio: ratios[f.schemeCode]?.expenseRatio ?? null
  }));
  return NextResponse.json(lightList);
}