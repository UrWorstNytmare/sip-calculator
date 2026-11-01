const CONTACT_EMAIL = 'arpit1999agrawal@gmail.com'; // <-- REPLACE with your real email

export const metadata = { title: 'Terms of Use — SIP Calculator' };

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-700 text-sm leading-relaxed space-y-4">
        <a href="/" className="text-indigo-600 hover:underline">&larr; Back to Calculator</a>
        <h1 className="text-2xl font-bold text-slate-800">Terms of Use</h1>
        <p className="text-slate-400">Last updated: November 2026</p>
        <h2 className="font-semibold text-slate-800 pt-2">Use of the site</h2>
        <p>By using this site you agree to these terms. The calculators and fund information are provided free for general, educational use only.</p>
        <h2 className="font-semibold text-slate-800 pt-2">No guarantee</h2>
        <p>We try to keep data accurate but do not guarantee it is complete, current or error-free. Fund data is sourced from public sources and may be delayed.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Limitation of liability</h2>
        <p>To the fullest extent permitted by law, we are not liable for any loss arising from use of this site or reliance on its results.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Third-party links and ads</h2>
        <p>The site may show ads or links to third parties. We are not responsible for their content or practices.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Changes</h2>
        <p>We may change the site or these terms at any time. Continued use means you accept the updated terms.</p>

        <p>Contact: <a className="text-indigo-600 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </div>
    </main>
  );
}