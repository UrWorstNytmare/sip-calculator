'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

const MIN_START_DATE = '2000-01-01';
const MAX_AMOUNT = 10000000;
const MAX_RETURN_PCT = 100;
const MAX_YEARS = 80;
const MAX_STEP_UP = 50;
const LTCG_EXEMPTION = 125000;
const LTCG_RATE = 0.125;
const STCG_RATE = 0.20;

function toNum(v, fallback = 0) {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// mfapi.in history is sorted newest-first ("DD-MM-YYYY"). Real SIP allotment
// uses the NEXT trading day's NAV if the chosen date isn't a trading day.
function findNextTradingNav(history, targetDate) {
  let match = null;
  for (const entry of history) {
    const [d, m, y] = entry.date.split('-');
    const entryDate = new Date(`${y}-${m}-${d}`);
    if (entryDate >= targetDate) {
      match = { nav: parseFloat(entry.nav), date: entry.date, dateObj: entryDate };
    } else {
      break;
    }
  }
  return match;
}

function shiftPastWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

function clampReturn(n) {
  return Math.min(MAX_RETURN_PCT, Math.max(0, n));
}

function calculateForFund(fund, years, startDate, todayStr, stepUpPercent) {
  const periodsPerYear = fund.frequency === 'monthly' ? 12 : 1;
  const totalPeriods = years * periodsPerYear;
  const rate = parseFloat(fund.expectedReturn);
  const periodRate = Math.pow(1 + rate / 100, 1 / periodsPerYear) - 1;
  const parsedStart = new Date(startDate);
  const today = new Date(todayStr);
  const history = fund.detail.history;
  const earliestHistoryNav = history.length
    ? parseFloat(history[history.length - 1].nav)
    : fund.detail.latestNav;

  let cumulativeUnits = 0;
  let cumulativeInvested = 0;
  let periodsSinceToday = 0;
  const installments = [];
  const yearlyMap = new Map();

  for (let i = 0; i < totalPeriods; i++) {
    const rawDate = new Date(parsedStart);
    if (fund.frequency === 'monthly') rawDate.setMonth(rawDate.getMonth() + i);
    else rawDate.setFullYear(rawDate.getFullYear() + i);

    const yearIndexZero = fund.frequency === 'monthly' ? Math.floor(i / 12) : i;
    const installmentAmount = fund.amount * Math.pow(1 + stepUpPercent / 100, yearIndexZero);

    let displayDate, nav, isProjected, note = '';
    if (rawDate <= today) {
      const hist = findNextTradingNav(history, rawDate);
      if (hist) {
        nav = hist.nav;
        displayDate = hist.date.split('-').reverse().join('-');
        const gapDays = (hist.dateObj - rawDate) / 86400000;
        if (gapDays > 10) note = 'fund may not have existed yet — earliest available NAV used';
        else if (gapDays > 0) note = "shifted to next trading day";
      } else {
        nav = earliestHistoryNav;
        displayDate = rawDate.toISOString().split('T')[0];
        note = 'no NAV data found for this date';
      }
      isProjected = false;
    } else {
      periodsSinceToday += 1;
      const shifted = shiftPastWeekend(rawDate);
      displayDate = shifted.toISOString().split('T')[0];
      if (shifted.getTime() !== rawDate.getTime()) note = 'shifted off a weekend (approximate)';
      nav = fund.detail.latestNav * Math.pow(1 + periodRate, periodsSinceToday);
      isProjected = true;
    }

    const units = installmentAmount / nav;
    cumulativeUnits += units;
    cumulativeInvested += installmentAmount;
    const value = cumulativeUnits * nav;

    installments.push({ date: displayDate, nav, isProjected, note, invested: installmentAmount, cumulativeInvested, value });

    const yearLabel = fund.frequency === 'monthly' ? Math.ceil((i + 1) / 12) : i + 1;
    yearlyMap.set(yearLabel, { year: yearLabel, invested: cumulativeInvested, value });
  }

  return {
    installments,
    yearlyRows: Array.from(yearlyMap.values()),
    finalValue: installments[installments.length - 1]?.value || 0,
    totalInvested: cumulativeInvested
  };
}

// NAV for an arbitrary withdrawal date: real historical NAV if on/before
// today, otherwise a continuous compound projection from the latest NAV.
function getNavAtDate(fundDetail, targetDate, todayDate, annualRatePct) {
  if (targetDate <= todayDate) {
    const hist = findNextTradingNav(fundDetail.history, targetDate);
    return hist ? hist.nav : fundDetail.latestNav;
  }
  const daysAhead = (targetDate - todayDate) / 86400000;
  return fundDetail.latestNav * Math.pow(1 + annualRatePct / 100, daysAhead / 365.25);
}

// FIFO lot-wise LTCG/STCG split for a single lump-sum withdrawal.
function calculateWithdrawal(fund, installments, withdrawalDateStr, todayStr, annualRatePct) {
  const withdrawalDate = new Date(withdrawalDateStr);
  const today = new Date(todayStr);
  const nav = getNavAtDate(fund.detail, withdrawalDate, today, annualRatePct);

  let totalInvested = 0, stcgGain = 0, ltcgGain = 0, totalUnits = 0;
  installments.forEach(inst => {
    const purchaseDate = new Date(inst.date);
    const units = inst.invested / inst.nav;
    totalUnits += units;
    totalInvested += inst.invested;
    const gain = units * nav - inst.invested;
    const holdingDays = (withdrawalDate - purchaseDate) / 86400000;
    if (holdingDays >= 365) ltcgGain += gain; else stcgGain += gain;
  });

  const currentValue = totalUnits * nav;
  const taxableLTCG = Math.max(0, ltcgGain - LTCG_EXEMPTION);
  const ltcgTax = taxableLTCG * LTCG_RATE;
  const stcgTax = Math.max(0, stcgGain) * STCG_RATE;
  const totalTax = ltcgTax + stcgTax;

  return { nav, totalInvested, currentValue, stcgGain, ltcgGain, ltcgTax, stcgTax, totalTax, netAmount: currentValue - totalTax };
}

export default function Home() {
  const [allFunds, setAllFunds] = useState([]);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const nextId = useRef(1);

  function createEmptyFund() {
    return {
      id: nextId.current++,
      query: '',
      selected: null,
      detail: null,
      loadingDetail: false,
      amount: 5000,
      frequency: 'monthly',
      expectedReturn: '',
      stepUp: 0
    };
  }

  const [portfolioFunds, setPortfolioFunds] = useState(() => [createEmptyFund()]);
  const [years, setYears] = useState(10);
  const [startDate, setStartDate] = useState(todayStr);
  const [applySameStepUp, setApplySameStepUp] = useState(false);
  const [globalStepUp, setGlobalStepUp] = useState(0);

  const [result, setResult] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/funds')
      .then(res => res.json())
      .then(setAllFunds)
      .catch(() => setError('Could not load fund list.'));
  }, []);

  function updateFund(id, changes) {
    setPortfolioFunds(prev => prev.map(f => (f.id === id ? { ...f, ...changes } : f)));
  }

  function addFund() {
    setPortfolioFunds(prev => [...prev, createEmptyFund()]);
  }

  function removeFund(id) {
    setPortfolioFunds(prev => prev.filter(f => f.id !== id));
  }

  async function selectFundForRow(id, fund) {
    updateFund(id, {
      selected: fund,
      query: `${fund.schemeName} - ${fund.plan} ${fund.option}`,
      detail: null,
      loadingDetail: true
    });
    try {
      const res = await fetch(`/api/fund/${fund.schemeCode}`);
      const data = await res.json();
      const er = data.cagr?.threeYear ?? data.cagr?.oneYear ?? 0;
      updateFund(id, { detail: data, loadingDetail: false, expectedReturn: String(clampReturn(er)) });
    } catch {
      updateFund(id, { loadingDetail: false });
      setError('Could not load details for one of the selected funds.');
    }
  }

  function handleYearsChange(value) {
    const n = Math.round(toNum(value, 1));
    setYears(Math.min(MAX_YEARS, Math.max(1, n)));
  }

  function handleStartDateChange(value) {
    if (!value) { setStartDate(todayStr); return; }
    if (value < MIN_START_DATE) { setStartDate(MIN_START_DATE); return; }
    if (value > todayStr) { setStartDate(todayStr); return; }
    setStartDate(value);
  }

  function calculate() {
    setError('');
    if (portfolioFunds.length === 0) { setError('Add at least one fund.'); return; }
    if (!years || !Number.isInteger(years) || years < 1 || years > MAX_YEARS) {
      setError(`Enter a whole number of years between 1 and ${MAX_YEARS}.`);
      return;
    }
    const parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) { setError('Please enter a valid start date.'); return; }
    if (parsedStart > new Date(todayStr)) { setError('Start date cannot be in the future.'); return; }
    if (applySameStepUp && (globalStepUp < 0 || globalStepUp > MAX_STEP_UP)) {
      setError(`Step-up % must be between 0 and ${MAX_STEP_UP}.`);
      return;
    }

    for (const f of portfolioFunds) {
      if (!f.detail) { setError('Please select a fund for every row.'); return; }
      if (!f.amount || f.amount <= 0 || f.amount > MAX_AMOUNT) {
        setError(`Amount must be between ₹1 and ₹${MAX_AMOUNT.toLocaleString('en-IN')} for each fund.`);
        return;
      }
      const rate = parseFloat(f.expectedReturn);
      if (isNaN(rate) || rate < 0 || rate > MAX_RETURN_PCT) {
        setError('Enter a valid expected return (0-100%) for each fund.');
        return;
      }
      if (!applySameStepUp && (f.stepUp < 0 || f.stepUp > MAX_STEP_UP)) {
        setError(`Step-up % must be between 0 and ${MAX_STEP_UP} for each fund.`);
        return;
      }
    }

    const perFund = portfolioFunds.map(f => {
      const stepUp = applySameStepUp ? globalStepUp : (f.stepUp || 0);
      const res = calculateForFund(f, years, startDate, todayStr, stepUp);
      return { fund: f, fundLabel: `${f.detail.schemeName} — ${f.selected.plan} ${f.selected.option}`, ...res };
    });

    const combinedTotalInvested = perFund.reduce((s, r) => s + r.totalInvested, 0);
    const combinedFinalValue = perFund.reduce((s, r) => s + r.finalValue, 0);

    const combinedYearlyMap = new Map();
    perFund.forEach(r => {
      r.yearlyRows.forEach(yr => {
        const existing = combinedYearlyMap.get(yr.year) || { year: yr.year, invested: 0, value: 0 };
        existing.invested += yr.invested;
        existing.value += yr.value;
        combinedYearlyMap.set(yr.year, existing);
      });
    });

    setResult({
      perFund,
      combined: {
        totalInvested: combinedTotalInvested,
        finalValue: combinedFinalValue,
        yearlyRows: Array.from(combinedYearlyMap.values())
      }
    });
  }

  function requestReset() {
    setShowResetConfirm(true);
  }

  function confirmReset() {
    setPortfolioFunds([createEmptyFund()]);
    setYears(10);
    setStartDate(todayStr);
    setApplySameStepUp(false);
    setGlobalStepUp(0);
    setResult(null);
    setError('');
    setShowResetConfirm(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">SIP Calculator</h1>
        <p className="text-slate-500 mb-6">Plan a multi-fund SIP portfolio with real fund data.</p>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 text-sm">
          <h2 className="font-semibold text-slate-800 mb-2">Capital Gains Tax on Equity Funds (FY 2026-27)</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li><strong>Held over 12 months (LTCG):</strong> 12.5% tax on gains above ₹1.25 lakh in a financial year (this exemption is shared across all your equity fund gains that year, not per fund).</li>
            <li><strong>Held under 12 months (STCG):</strong> flat 20% tax, no exemption.</li>
            <li>Debt funds (bought after Apr 2023) are always taxed at your income slab rate — not covered by this calculator yet.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of Years (1–{MAX_YEARS})</label>
            <input type="number" min="1" max={MAX_YEARS} step="1" onFocus={e => e.target.select()}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={years} onChange={e => handleYearsChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SIP Start Date</label>
            <input type="date" min={MIN_START_DATE} max={todayStr}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1 mt-6 sm:mt-0">
              <input type="checkbox" checked={applySameStepUp} onChange={e => setApplySameStepUp(e.target.checked)} />
              Same step-up % for all funds
            </label>
            {applySameStepUp && (
              <input type="number" min="0" max={MAX_STEP_UP} step="0.5" onFocus={e => e.target.select()}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
                value={globalStepUp} onChange={e => setGlobalStepUp(Math.min(MAX_STEP_UP, Math.max(0, toNum(e.target.value))))} />
            )}
          </div>
        </div>

        {portfolioFunds.map((f, idx) => {
          const filtered = f.query.length >= 2 && !f.selected
            ? allFunds.filter(x => x.schemeName.toLowerCase().includes(f.query.toLowerCase())).slice(0, 20)
            : [];
          return (
            <div key={f.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4 relative">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-slate-700">Fund {idx + 1}</h3>
                {portfolioFunds.length > 1 && (
                  <button onClick={() => removeFund(f.id)} className="text-red-500 text-sm hover:underline">Remove</button>
                )}
              </div>

              <label className="block text-sm font-medium text-slate-700 mb-1">Search Fund</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-1"
                placeholder="Type at least 2 letters, e.g. Axis Bluechip"
                value={f.query}
                onChange={e => updateFund(f.id, { query: e.target.value, selected: null, detail: null })}
              />
              {filtered.length > 0 && (
                <div className="relative z-10 bg-white border border-slate-200 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-lg">
                  {filtered.map(fd => (
                    <button
                      key={fd.schemeCode + fd.plan + fd.option}
                      onClick={() => selectFundForRow(f.id, fd)}
                      className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                    >
                      {fd.schemeName} <span className="text-slate-400">— {fd.plan} {fd.option}</span>
                    </button>
                  ))}
                </div>
              )}

              {f.loadingDetail && <p className="text-sm text-slate-400 mt-2">Loading fund details…</p>}

              {f.detail && (
                <div className="mt-3 bg-slate-50 rounded-xl p-4 text-sm space-y-1">
                  <p><strong>{f.detail.schemeName}</strong></p>
                  <p>Fund House: {f.detail.fundHouse} · Category: {f.detail.schemeCategory}</p>
                  <p>Latest NAV: ₹{f.detail.latestNav?.toFixed(2)} (as of {f.detail.latestDate})</p>
                  <p>
                    CAGR — 6M: {fmtPct(f.detail.cagr.sixMonth)} | 1Y: {fmtPct(f.detail.cagr.oneYear)} | 3Y: {fmtPct(f.detail.cagr.threeYear)} | 5Y: {fmtPct(f.detail.cagr.fiveYear)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹, max 1 crore)</label>
                  <input type="number" min="100" max={MAX_AMOUNT} step="100" onFocus={e => e.target.select()}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    value={f.amount} onChange={e => updateFund(f.id, { amount: Math.min(MAX_AMOUNT, Math.max(0, toNum(e.target.value))) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    value={f.frequency} onChange={e => updateFund(f.id, { frequency: e.target.value })}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Annually</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Annual Return (%, max {MAX_RETURN_PCT})</label>
                  <input type="number" min="0" max={MAX_RETURN_PCT} step="0.01" onFocus={e => e.target.select()}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    value={f.expectedReturn} onChange={e => updateFund(f.id, { expectedReturn: String(clampReturn(toNum(e.target.value))) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Step-up % per year (max {MAX_STEP_UP})</label>
                  <input type="number" min="0" max={MAX_STEP_UP} step="0.5" disabled={applySameStepUp} onFocus={e => e.target.select()}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={applySameStepUp ? globalStepUp : f.stepUp}
                    onChange={e => updateFund(f.id, { stepUp: Math.min(MAX_STEP_UP, Math.max(0, toNum(e.target.value))) })} />
                  {applySameStepUp && <p className="text-xs text-slate-400 mt-1">Using the global step-up % above.</p>}
                </div>
              </div>
            </div>
          );
        })}

        <button onClick={addFund} className="mb-6 text-indigo-600 font-medium hover:underline">+ Add Another Fund</button>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-3 mb-8">
          <button onClick={calculate}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700">
            Calculate
          </button>
          <button onClick={requestReset}
            className="bg-slate-200 text-slate-700 px-5 py-2 rounded-lg font-medium hover:bg-slate-300">
            Reset
          </button>
        </div>

        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <p className="mb-4">Reset all funds and values? This can't be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 rounded-lg bg-slate-100">Cancel</button>
                <button onClick={confirmReset} className="px-4 py-2 rounded-lg bg-red-600 text-white">Yes, Reset</button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-800 mb-2">Portfolio Summary</h2>
              <p>Total Invested: ₹{Math.round(result.combined.totalInvested).toLocaleString('en-IN')}</p>
              <p>Projected Value: ₹{Math.round(result.combined.finalValue).toLocaleString('en-IN')}</p>
              <p>Estimated Gain: ₹{Math.round(result.combined.finalValue - result.combined.totalInvested).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 overflow-x-auto">
              <h2 className="font-semibold text-slate-800 mb-2">Combined Yearly Growth</h2>
              <YearlyTable rows={result.combined.yearlyRows} />
            </div>

            {result.perFund.map((r, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 overflow-x-auto">
                <h2 className="font-semibold text-slate-800 mb-2">{r.fundLabel}</h2>
                <p className="text-sm text-slate-600 mb-2">
                  Invested: ₹{Math.round(r.totalInvested).toLocaleString('en-IN')} · Value: ₹{Math.round(r.finalValue).toLocaleString('en-IN')} · Gain: ₹{Math.round(r.finalValue - r.totalInvested).toLocaleString('en-IN')}
                </p>
                <YearlyTable rows={r.yearlyRows} />
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-indigo-600">Show installment-wise detail</summary>
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="text-left border-b border-slate-200">
                        <th className="py-1 pr-4">Date</th>
                        <th className="py-1 pr-4">NAV (₹)</th>
                        <th className="py-1 pr-4">Type</th>
                        <th className="py-1 pr-4">Invested (₹)</th>
                        <th className="py-1">Cumulative Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.installments.map((row, i2) => (
                        <tr key={i2} className="border-b border-slate-100">
                          <td className="py-1 pr-4">{row.date}</td>
                          <td className="py-1 pr-4">{row.nav.toFixed(2)}</td>
                          <td className="py-1 pr-4">
                            {row.isProjected ? 'Projected' : 'Actual'}
                            {row.note && <span className="text-amber-600 text-xs block">({row.note})</span>}
                          </td>
                          <td className="py-1 pr-4">{Math.round(row.invested).toLocaleString('en-IN')}</td>
                          <td className="py-1">{Math.round(row.value).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>

                <WithdrawalPlanner fund={r.fund} installments={r.installments} todayStr={todayStr} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function WithdrawalPlanner({ fund, installments, todayStr }) {
  const lastDate = installments[installments.length - 1]?.date || todayStr;

  const allLtcgDate = useMemo(() => {
    let maxDate = new Date(installments[0]?.date || todayStr);
    installments.forEach(inst => {
      const d = new Date(inst.date);
      d.setDate(d.getDate() + 365);
      if (d > maxDate) maxDate = d;
    });
    return maxDate.toISOString().split('T')[0];
  }, [installments, todayStr]);

  const [withdrawalDate, setWithdrawalDate] = useState(lastDate);
  const rate = parseFloat(fund.expectedReturn) || 0;

  const w = useMemo(
    () => calculateWithdrawal(fund, installments, withdrawalDate, todayStr, rate),
    [fund, installments, withdrawalDate, todayStr, rate]
  );

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <h3 className="font-semibold text-slate-700 mb-2">Withdrawal Planner (lump sum)</h3>
      <div className="flex flex-wrap gap-3 items-end mb-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Withdrawal Date</label>
          <input type="date" min={MIN_START_DATE} value={withdrawalDate}
            onChange={e => setWithdrawalDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={() => setWithdrawalDate(lastDate)}
          className="text-xs text-indigo-600 hover:underline">Withdraw right after SIP ends</button>
        <button onClick={() => setWithdrawalDate(allLtcgDate)}
          className="text-xs text-indigo-600 hover:underline">Hold until fully LTCG ({allLtcgDate})</button>
      </div>
      <table className="w-full text-sm">
        <tbody>
          <tr><td className="py-1 pr-4 text-slate-500">Invested</td><td className="py-1">₹{Math.round(w.totalInvested).toLocaleString('en-IN')}</td></tr>
          <tr><td className="py-1 pr-4 text-slate-500">Current Value at Withdrawal</td><td className="py-1">₹{Math.round(w.currentValue).toLocaleString('en-IN')}</td></tr>
          <tr><td className="py-1 pr-4 text-slate-500">Short-term Gain (STCG)</td><td className="py-1">₹{Math.round(w.stcgGain).toLocaleString('en-IN')}</td></tr>
          <tr><td className="py-1 pr-4 text-slate-500">Long-term Gain (LTCG)</td><td className="py-1">₹{Math.round(w.ltcgGain).toLocaleString('en-IN')}</td></tr>
          <tr><td className="py-1 pr-4 text-slate-500">STCG Tax (20%)</td><td className="py-1 text-red-600">₹{Math.round(w.stcgTax).toLocaleString('en-IN')}</td></tr>
          <tr><td className="py-1 pr-4 text-slate-500">LTCG Tax (12.5% above ₹1.25L)</td><td className="py-1 text-red-600">₹{Math.round(w.ltcgTax).toLocaleString('en-IN')}</td></tr>
          <tr className="font-semibold border-t border-slate-200"><td className="py-1 pr-4">Net Amount After Tax</td><td className="py-1">₹{Math.round(w.netAmount).toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2">Each SIP installment is treated as a separate purchase lot (as tax rules require) — some lots may be LTCG and others STCG depending on how long each has been held. Assumes this is the only equity LTCG you realize that financial year.</p>
    </div>
  );
}

function YearlyTable({ rows }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b border-slate-200">
          <th className="py-1 pr-4">Year</th>
          <th className="py-1 pr-4">Invested (₹)</th>
          <th className="py-1 pr-4">Value (₹)</th>
          <th className="py-1">Gain (₹)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.year} className="border-b border-slate-100">
            <td className="py-1 pr-4">{r.year}</td>
            <td className="py-1 pr-4">{Math.round(r.invested).toLocaleString('en-IN')}</td>
            <td className="py-1 pr-4">{Math.round(r.value).toLocaleString('en-IN')}</td>
            <td className="py-1">{Math.round(r.value - r.invested).toLocaleString('en-IN')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fmtPct(v) {
  return v === null || v === undefined ? 'N/A' : `${v.toFixed(2)}%`;
}