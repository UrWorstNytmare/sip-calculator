import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SIP Calculator — Plan Your Mutual Fund SIP",
  description: "A free online SIP Calculator helps you estimate future returns on your mutual fund Systematic Investment Plans (SIP) using monthly investments, expected returns, and time periods.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
          <p className="mb-2">For education only. Not investment advice. Mutual fund investments are subject to market risks.</p>
          <a href="/privacy" className="mx-2 hover:underline">Privacy Policy</a>
          <a href="/terms" className="mx-2 hover:underline">Terms of Use</a>
          <a href="/disclaimer" className="mx-2 hover:underline">Disclaimer</a>
        </footer>
      </body>
    </html>
  );
}