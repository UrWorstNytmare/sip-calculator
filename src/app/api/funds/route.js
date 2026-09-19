import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'funds.json');
  const funds = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const lightList = funds.map(f => ({
    schemeCode: f.schemeCode,
    schemeName: f.schemeName,
    plan: f.plan,
    option: f.option,
    amc: f.amc,
    category: f.category,
    nav: f.nav,
    date: f.date
  }));
  return NextResponse.json(lightList);
}
