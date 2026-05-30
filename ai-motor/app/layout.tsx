import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./workspace-theme.css";
import "../styles/ios-overrides.css";
import { ThemeProvider } from "@/components/theme-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const geist = localFont({
  src: [
    {
      path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-geist",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "MotorsAI · Factory OS",
  description: "Eigen stack voor apps, chat en kennisbank",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "MotorsAI",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08080A" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`dark ${poppins.variable} ${geist.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased ios-body">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
