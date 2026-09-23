'use client';

import { useState, useEffect, useMemo } from 'react';

const PAGE_SIZE = 50;

export default function Explore() {
  const [allFunds, setAllFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [amc, setAmc] = useState('All');
  const [plan, setPlan] = useState('All');
  const [option, setOption] = useState('All');
  const [navMin, setNavMin] = useState('');
  const [navMax, setNavMax] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState('schemeName');
  const [sortDir, setSortDir] = useState('asc');

  const [cagrMap, setCagrMap] = useState({});
  const [loadingReturns, setLoadingReturns] = useState(false);

  useEffect(() => {
    fetch('/api/funds')
      .then(res => res.json())
      .then(data => { setAllFunds(data); setLoading(false); })
      .catch(() => { setError('Could not load fund list.'); setLoading(false); });
  }, []);

  const activeFunds = useMemo(() => allFunds.filter(f => f.nav !== null), [allFunds]);
  const baseList = showInactive ? allFunds : activeFunds;

  const categories = useMemo(() => ['All', ...new Set(baseList.map(f => f.category).filter(Boolean))].sort(), [baseList]);
  const amcs = useMemo(() => ['All', ...new Set(baseList.map(f => f.amc).filter(Boolean))].sort(), [baseList]);
  const plans = useMemo(() => ['All', ...new Set(baseList.map(f => f.plan).filter(Boolean))].sort(), [baseList]);
  const options = useMemo(() => ['All', ...new Set(baseList.map(f => f.option).filter(Boolean))].sort(), [baseList]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const min = navMin === '' ? -Infinity : Number(navMin);
    const max = navMax === '' ? Infinity : Number(navMax);
    let list = baseList.filter(f =>
      (!q || f.schemeName.toLowerCase().includes(q)) &&
      (category === 'All' || f.category === category) &&
      (amc === 'All' || f.amc === amc) &&
      (plan === 'All' || f.plan === plan) &&
      (option === 'All' || f.option === option) &&
      (f.nav === null || (f.nav >= min && f.nav <= max))
    );

    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortBy === 'nav') { av = a.nav ?? -Infinity; bv = b.nav ?? -Infinity; }
      else if (sortBy === 'cagr1y') { av = cagrMap[a.schemeCode]?.oneYear ?? -Infinity; bv = cagrMap[b.schemeCode]?.oneYear ?? -Infinity; }
      else { av = a.schemeName; bv = b.schemeName; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [baseList, query, category, amc, plan, option, navMin, navMax, sortBy, sortDir, cagrMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() {
    setPage(1);
  }

  async function loadReturnsForPage() {
    setLoadingReturns(true);
    try {
      const codesNeeded = pageRows.filter(f => !cagrMap[f.schemeCode]).map(f => f.schemeCode);
      const results = await Promise.all(
        codesNeeded.map(code =>
          fetch(`/api/fund/${code}`).then(r => r.json()).then(d => ({ code, cagr: d.cagr })).catch(() => ({ code, cagr: null }))
        )
      );
      setCagrMap(prev => {
        const next = { ...prev };
        results.forEach(r => { if (r.cagr) next[r.code] = r.cagr; });
        return next;
      });
    } finally {
      setLoadingReturns(false);
    }
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm text-indigo-600 hover:underline">&larr; Back to Calculator</a>
        <h1 className="text-2xl font-bold text-slate-800 mt-2 mb-1">Fund Explorer</h1>
        <p className="text-slate-500 mb-6">{activeFunds.length.toLocaleString('en-IN')} active schemes (of {allFunds.length.toLocaleString('en-IN')} total) — filter by category, AMC, plan, option and NAV.</p>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search Name</label>
            <input placeholder="e.g. Bluechip" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={query} onChange={e => { setQuery(e.target.value); resetPage(); }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
            <select className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" value={category} onChange={e => { setCategory(e.target.value); resetPage(); }}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">AMC (Fund House)</label>
            <select className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" value={amc} onChange={e => { setAmc(e.target.value); resetPage(); }}>
              {amcs.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Plan</label>
            <select className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" value={plan} onChange={e => { setPlan(e.target.value); resetPage(); }}>
              {plans.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Option (Growth/IDCW)</label>
            <select className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" value={option} onChange={e => { setOption(e.target.value); resetPage(); }}>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Min NAV (₹)</label>
            <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={navMin} onChange={e => { setNavMin(e.target.value); resetPage(); }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Max NAV (₹)</label>
            <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={navMax} onChange={e => { setNavMax(e.target.value); resetPage(); }} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showInactive} onChange={e => { setShowInactive(e.target.checked); resetPage(); }} />
              Include inactive/segregated schemes
            </label>
          </div>
        </div>

        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-slate-500">{filtered.length.toLocaleString('en-IN')} funds match · page {page} of {totalPages}</p>
          <button onClick={loadReturnsForPage} disabled={loadingReturns}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loadingReturns ? 'Loading returns…' : 'Load Returns for This Page'}
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading fund list…</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 bg-slate-50">
                  <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('schemeName')}>Scheme Name {sortBy === 'schemeName' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th className="py-2 px-3">AMC</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Plan / Option</th>
                  <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('nav')}>NAV (₹) {sortBy === 'nav' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('cagr1y')}>1Y CAGR {sortBy === 'cagr1y' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(f => (
                  <tr key={f.schemeCode + f.plan + f.option} className="border-b border-slate-100">
                    <td className="py-1.5 px-3">{f.schemeName}</td>
                    <td className="py-1.5 px-3">{f.amc}</td>
                    <td className="py-1.5 px-3">{f.category}</td>
                    <td className="py-1.5 px-3">{f.plan || '—'} / {f.option || '—'}</td>
                    <td className="py-1.5 px-3">{f.nav?.toFixed(2) ?? 'Inactive'}</td>
                    <td className="py-1.5 px-3">{cagrMap[f.schemeCode]?.oneYear != null ? `${cagrMap[f.schemeCode].oneYear.toFixed(2)}%` : '—'}</td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">No funds match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-200 disabled:opacity-40 text-sm">Previous</button>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-200 disabled:opacity-40 text-sm">Next</button>
        </div>

        <p className="text-xs text-slate-400 mt-6">Expense ratio and fund size (AUM) filters are coming — we found a real official free source and are wiring it up next. "Load Returns" fetches CAGR only for the 50 funds currently on screen to keep things fast.</p>
      </div>
    </main>
  );
}