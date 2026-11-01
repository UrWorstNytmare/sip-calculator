const CONTACT_EMAIL = 'arpit1999agrawal@gmail.com'; // <-- REPLACE with your real email

export const metadata = { title: 'Privacy Policy — SIP Calculator' };

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-700 text-sm leading-relaxed space-y-4">
        <a href="/" className="text-indigo-600 hover:underline">&larr; Back to Calculator</a>
        <h1 className="text-2xl font-bold text-slate-800">Privacy Policy</h1>
        <p className="text-slate-400">Last updated: November 2026</p>
        <h2 className="font-semibold text-slate-800 pt-2">What we collect</h2>
        <p>This site has no accounts and does not ask for your name, email or phone number. The amounts, dates and funds you enter in the calculator are processed in your browser and are not stored on our servers.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Automatically collected data</h2>
        <p>Our hosting provider (Vercel) and analytics or advertising partners may collect technical data such as IP address, browser type, device type and pages visited.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Cookies and advertising</h2>
        <p>We use Google AdSense to show ads. Google and its partners use cookies to serve ads based on your visits to this and other websites. You can manage personalised advertising at https://adssettings.google.com or opt out of some third-party vendors at https://www.aboutads.info.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Third-party services</h2>
        <p>Fund data is fetched from public sources (AMFI and mfapi.in). Those services have their own privacy practices.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Children</h2>
        <p>This site is not intended for children under 18.</p>
        <h2 className="font-semibold text-slate-800 pt-2">Changes</h2>
        <p>We may update this policy from time to time. The date above shows the latest version.</p>

        <p>Contact: <a className="text-indigo-600 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </div>
    </main>
  );
}