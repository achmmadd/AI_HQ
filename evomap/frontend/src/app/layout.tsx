import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-Holding Evomap",
  description: "Realtime multi-agent dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
