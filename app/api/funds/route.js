import funds from '../../../data/funds.json';
import { NextResponse } from 'next/server';

export async function GET() {
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
