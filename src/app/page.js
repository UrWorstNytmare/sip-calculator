'use client';

import { useState, useEffect, useMemo } from 'react';

const MIN_START_DATE = '2000-01-01';
const MAX_AMOUNT = 10000000; // ₹1 crore per installment — well beyond typical retail SIP use
const MAX_RETURN_PCT = 100;  // highest real 1-year mutual fund returns in India have peaked near 70-80%
const MAX_YEARS = 80;

export default function Home() {
  const [funds, setFunds] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedFund, setSelectedFund] = useState(null);
  const [fundDetail, setFundDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [amount, setAmount] = useState(5000);
  const [frequency, setFrequency] = useState('monthly');
  const [years, setYears] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState('');
  const [startDate, setStartDate] = useState(todayStr);

  const [result, setResult] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/funds')
      .then(res => res.json())
      .then(setFunds)
      .catch(() => setError('Could not load fund list.'));
  }, []);

  const filteredFunds = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return funds.filter(f => f.schemeName.toLowerCase().includes(q)).slice(0, 20);
  }, [query, funds]);

  async function selectFund(fund) {
    setSelectedFund(fund);
    setQuery(`${fund.schemeName} - ${fund.plan} ${fund.option}`);
    setFundDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/fund/${fund.schemeCode}`);
      const data = await res.json();
      setFundDetail(data);
      if (data.cagr?.threeYear) {
        setExpectedReturn(clampReturn(data.cagr.threeYear).toFixed(2));
      } else if (data.cagr?.oneYear) {
        setExpectedReturn(clampReturn(data.cagr.oneYear).toFixed(2));
      }
    } catch {
      setError('Could not load fund details.');
    } finally {
      setLoadingDetail(false);
    }
  }

  function clampReturn(n) {
    return Math.min(MAX_RETURN_PCT, Math.max(0, n));
  }

  function handleAmountChange(value) {
    const n = Number(value);
    if (isNaN(n)) { setAmount(''); return; }
    setAmount(Math.min(MAX_AMOUNT, Math.max(0, n)));
  }

  function handleExpectedReturnChange(value) {
    if (value === '') { setExpectedReturn(''); return; }
    const n = Number(value);
    if (isNaN(n)) return;
    setExpectedReturn(String(clampReturn(n)));
  }

  function handleStartDateChange(value) {
    if (!value) { setStartDate(todayStr); return; }
    if (value < MIN_START_DATE) { setStartDate(MIN_START_DATE); return; }
    if (value > todayStr) { setStartDate(todayStr); return; }
    setStartDate(value);
  }

  function handleYearsChange(value) {
    const n = Math.round(Number(value));
    if (isNaN(n)) { setYears(''); return; }
    setYears(Math.min(MAX_YEARS, Math.max(1, n)));
  }

  // mfapi.in history is sorted newest-first ("DD-MM-YYYY"). When a chosen
  // installment date isn't a trading day (weekend/holiday), real SIP
  // allotment uses the NEXT trading day's NAV — so we search forward for
  // the earliest entry on/after targetDate, not backward.
  function findNextTradingNav(history, targetDate) {
    let match = null;
    for (const entry of history) {
      const [d, m, y] = entry.date.split('-');
      const entryDate = new Date(`${y}-${m}-${d}`);
      if (entryDate >= targetDate) {
        match = { nav: parseFloat(entry.nav), date: entry.date, dateObj: entryDate };
      } else {
        break; // history is descending, so anything further is even older
      }
    }
    return match;
  }

  // For future (projected) dates we have no real trading calendar, so we
  // only approximate by pushing weekends to the following Monday.
  function shiftPastWeekend(date) {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 6) d.setDate(d.getDate() + 2);
    else if (day === 0) d.setDate(d.getDate() + 1);
    return d;
  }

  function calculate() {
    setError('');
    if (!fundDetail) { setError('Please select a fund first.'); return; }
    if (!amount || amount <= 0 || amount > MAX_AMOUNT) {
      setError(`Enter an amount between ₹1 and ₹${MAX_AMOUNT.toLocaleString('en-IN')}.`);
      return;
    }
    if (!years || !Number.isInteger(years) || years < 1 || years > MAX_YEARS) {
      setError(`Enter a whole number of years between 1 and ${MAX_YEARS}.`);
      return;
    }
    const rate = parseFloat(expectedReturn);
    if (isNaN(rate) || rate < 0 || rate > MAX_RETURN_PCT) {
      setError(`Enter an expected annual return between 0% and ${MAX_RETURN_PCT}%.`);
      return;
    }

    const parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) { setError('Please enter a valid start date.'); return; }
    const today = new Date(todayStr);
    if (parsedStart > today) { setError('Start date cannot be in the future.'); return; }

    const periodsPerYear = frequency === 'monthly' ? 12 : 1;
    const totalPeriods = years * periodsPerYear;
    const periodRate = Math.pow(1 + rate / 100, 1 / periodsPerYear) - 1;
    const earliestHistoryNav = fundDetail.history.length
      ? parseFloat(fundDetail.history[fundDetail.history.length - 1].nav)
      : fundDetail.latestNav;

    let cumulativeUnits = 0;
    let cumulativeInvested = 0;
    let periodsSinceToday = 0;
    const installments = [];
    const yearlyMap = new Map();

    for (let i = 0; i < totalPeriods; i++) {
      const rawDate = new Date(parsedStart);
      if (frequency === 'monthly') rawDate.setMonth(rawDate.getMonth() + i);
      else rawDate.setFullYear(rawDate.getFullYear() + i);

      let displayDate, nav, isProjected, note = '';

      if (rawDate <= today) {
        const hist = findNextTradingNav(fundDetail.history, rawDate);
        if (hist) {
          nav = hist.nav;
          displayDate = hist.date.split('-').reverse().join('-'); // -> YYYY-MM-DD
          const gapDays = (hist.dateObj - rawDate) / (1000 * 60 * 60 * 24);
          if (gapDays > 10) {
            note = "fund may not have existed yet — earliest available NAV used";
          } else if (gapDays > 0) {
            note = `shifted to next trading day (chosen date wasn't a trading day)`;
          }
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
        if (shifted.getTime() !== rawDate.getTime()) {
          note = 'shifted off a weekend (approximate — future holidays not accounted for)';
        }
        nav = fundDetail.latestNav * Math.pow(1 + periodRate, periodsSinceToday);
        isProjected = true;
      }

      const units = amount / nav;
      cumulativeUnits += units;
      cumulativeInvested += amount;
      const value = cumulativeUnits * nav;

      installments.push({
        date: displayDate,
        nav,
        isProjected,
        note,
        invested: amount,
        cumulativeInvested,
        value
      });

      const yearLabel = frequency === 'monthly' ? Math.ceil((i + 1) / 12) : i + 1;
      yearlyMap.set(yearLabel, { year: yearLabel, invested: cumulativeInvested, value });
    }

    setResult({
      installments,
      yearlyRows: Array.from(yearlyMap.values()),
      finalValue: installments[installments.length - 1]?.value || 0,
      totalInvested: cumulativeInvested
    });
  }

  function requestReset() {
    setShowResetConfirm(true);
  }

  function confirmReset() {
    setAmount(5000);
    setFrequency('monthly');
    setYears(10);
    setExpectedReturn('');
    setStartDate(todayStr);
    setSelectedFund(null);
    setFundDetail(null);
    setQuery('');
    setResult(null);
    setError('');
    setShowResetConfirm(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">SIP Calculator</h1>
        <p className="text-slate-500 mb-6">Plan your mutual fund SIP with real fund data.</p>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Search Fund</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-1"
            placeholder="Type at least 2 letters, e.g. Axis Bluechip"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedFund(null); }}
          />
          {filteredFunds.length > 0 && !selectedFund && (
            <div className="absolute z-10 bg-white border border-slate-200 rounded-lg mt-1 w-[calc(100%-2.5rem)] max-h-64 overflow-y-auto shadow-lg">
              {filteredFunds.map(f => (
                <button
                  key={f.schemeCode + f.plan + f.option}
                  onClick={() => selectFund(f)}
                  className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                >
                  {f.schemeName} <span className="text-slate-400">— {f.plan} {f.option}</span>
                </button>
              ))}
            </div>
          )}

          {loadingDetail && <p className="text-sm text-slate-400 mt-2">Loading fund details…</p>}

          {fundDetail && (
            <div className="mt-4 bg-slate-50 rounded-xl p-4 text-sm space-y-1">
              <p><strong>{fundDetail.schemeName}</strong></p>
              <p>Fund House: {fundDetail.fundHouse}</p>
              <p>Category: {fundDetail.schemeCategory}</p>
              <p>
                Latest NAV: ₹{fundDetail.latestNav?.toFixed(2)} (as of {fundDetail.latestDate})
                <InfoTip text="NAV (Net Asset Value) is the per-unit price of the fund, updated daily." />
              </p>
              <p>
                CAGR — 6M: {fmtPct(fundDetail.cagr.sixMonth)} | 1Y: {fmtPct(fundDetail.cagr.oneYear)} | 3Y: {fmtPct(fundDetail.cagr.threeYear)} | 5Y: {fmtPct(fundDetail.cagr.fiveYear)}
                <InfoTip text="CAGR (Compound Annual Growth Rate) shows the fund's average yearly growth over that period. Past performance doesn't guarantee future returns." />
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹, max 1 crore)</label>
            <input type="number" min="100" max={MAX_AMOUNT} step="100" className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={amount} onChange={e => handleAmountChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
            <select className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={frequency} onChange={e => setFrequency(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Annually</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of Years (1–{MAX_YEARS})</label>
            <input type="number" min="1" max={MAX_YEARS} step="1" className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={years} onChange={e => handleYearsChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Annual Return (%, max {MAX_RETURN_PCT})</label>
            <input type="number" min="0" max={MAX_RETURN_PCT} step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={expectedReturn} onChange={e => handleExpectedReturnChange(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Only used for dates after today. Past dates use the fund's real historical NAV.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SIP Start Date</label>
            <input type="date" min={MIN_START_DATE} max={todayStr}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">A past date backtests with real NAVs up to today, then projects onward.</p>
          </div>
        </div>

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
              <p className="mb-4">Reset all values? This can't be undone.</p>
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
              <h2 className="font-semibold text-slate-800 mb-2">Summary</h2>
              <p>Total Invested: ₹{Math.round(result.totalInvested).toLocaleString('en-IN')}</p>
              <p>Projected Value: ₹{Math.round(result.finalValue).toLocaleString('en-IN')}</p>
              <p>Estimated Gain: ₹{Math.round(result.finalValue - result.totalInvested).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 overflow-x-auto">
              <h2 className="font-semibold text-slate-800 mb-2">Yearly Growth</h2>
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
                  {result.yearlyRows.map(r => (
                    <tr key={r.year} className="border-b border-slate-100">
                      <td className="py-1 pr-4">{r.year}</td>
                      <td className="py-1 pr-4">{Math.round(r.invested).toLocaleString('en-IN')}</td>
                      <td className="py-1 pr-4">{Math.round(r.value).toLocaleString('en-IN')}</td>
                      <td className="py-1">{Math.round(r.value - r.invested).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 overflow-x-auto">
              <h2 className="font-semibold text-slate-800 mb-2">Installment-wise Detail</h2>
              <p className="text-xs text-slate-400 mb-2">"Actual" rows use the fund's real historical NAV (next trading day if your date wasn't one). "Projected" rows (after today) use your expected return.</p>
              <table className="w-full text-sm">
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
                  {result.installments.map((r, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-1 pr-4">{r.date}</td>
                      <td className="py-1 pr-4">{r.nav.toFixed(2)}</td>
                      <td className="py-1 pr-4">
                        {r.isProjected ? 'Projected' : 'Actual'}
                        {r.note && <span className="text-amber-600 text-xs block">({r.note})</span>}
                      </td>
                      <td className="py-1 pr-4">{r.invested.toLocaleString('en-IN')}</td>
                      <td className="py-1">{Math.round(r.value).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function fmtPct(v) {
  return v === null || v === undefined ? 'N/A' : `${v.toFixed(2)}%`;
}

function InfoTip({ text }) {
  return (
    <span className="ml-1 inline-block relative group">
      <span className="text-slate-400 cursor-help text-xs border border-slate-300 rounded-full w-4 h-4 inline-flex items-center justify-center">i</span>
      <span className="hidden group-hover:block absolute left-0 top-5 z-10 w-56 bg-slate-800 text-white text-xs rounded-lg p-2 shadow-lg">
        {text}
      </span>
    </span>
  );
}