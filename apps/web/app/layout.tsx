import type { Metadata } from "next";
import Link from "next/link";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Second Brain",
  description: "Personal AI-powered engineering workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <nav className="border-b border-gray-200 bg-white">
          <div className="max-w-4xl mx-auto px-4 h-12 flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold text-gray-900">
              AI Second Brain
            </Link>
            <Link href="/documents" className="text-sm text-gray-500 hover:text-gray-900">
              Documents
            </Link>
            <Link href="/chat" className="text-sm text-gray-500 hover:text-gray-900">
              Chat
            </Link>
          </div>
        </nav>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
