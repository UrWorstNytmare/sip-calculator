const CONTACT_EMAIL = 'arpit1999agrawal@gmail.com'; // <-- REPLACE with your real email

export const metadata = { title: 'Disclaimer — SIP Calculator' };

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-700 text-sm leading-relaxed space-y-4">
        <a href="/" className="text-indigo-600 hover:underline">&larr; Back to Calculator</a>
        <h1 className="text-2xl font-bold text-slate-800">Disclaimer</h1>
        <p className="text-slate-400">Last updated: November 2026</p>
        <h2 className="font-semibold text-slate-800 pt-2">Not investment advice</h2>
        <p>This website is for information and education only. We are not a SEBI-registered investment adviser, and nothing here is investment, tax or legal advice. Consult a qualified professional before investing.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Projections are estimates</h2>
        <p>Future values are hypothetical, based on the return you enter, and are not guaranteed. Past performance does not indicate future results. Mutual fund investments are subject to market risks; read all scheme-related documents carefully.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Tax calculations</h2>
        <p>Tax figures use the capital gains rules for equity funds as understood at the time of writing and may change. Debt fund taxation is not covered. Your actual tax can differ.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Data sources</h2>
        <p>NAV and scheme data come from AMFI and mfapi.in; expense ratios come from AMFI's TER disclosures. Some data may be missing or delayed. Verify with the fund house before acting.</p>

        <p>Contact: <a className="text-indigo-600 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </div>
    </main>
  );
}