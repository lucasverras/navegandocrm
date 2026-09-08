import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Plus Jakarta Sans — one typeface for the whole product (body + display), loaded once with
// the weights the UI actually uses. Its geometric warmth + strong numerals suit a sales CRM.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar Navegando",
  description: "Sistema interno de SDR da Navegando MKT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster theme="light" position="top-right" richColors />
      </body>
    </html>
  );
}
