import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "AI Second Brain",
  description: "Personal AI-powered engineering workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="h-screen bg-gray-50 overflow-hidden flex">
        <Providers>
          <Sidebar />
          <main className="flex-1 h-full overflow-auto min-w-0">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
