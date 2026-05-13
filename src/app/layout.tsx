import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const codeFont = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-code",
});

export const metadata: Metadata = {
  title: "ESAI Premium Dashboard",
  description: "Academic competition workflow dashboard with Supabase-ready backend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${bodyFont.variable} ${displayFont.variable} ${codeFont.variable}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
