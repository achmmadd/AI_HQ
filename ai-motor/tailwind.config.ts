import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist)",
          "var(--font-poppins)",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "system-ui",
          "sans-serif",
        ],
        ws: ["var(--ws-font)", "sans-serif"],
        poppins: ["var(--font-poppins)", "Poppins", "sans-serif"],
        geist: ["var(--font-geist)", "Geist", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        elevated: "var(--surface-elevated)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "ws-accent": "var(--ws-accent)",
        "ws-accent-hover": "var(--ws-accent-hover)",
        "ws-accent-lt": "var(--ws-accent-lt)",
        "ws-yellow": "var(--ws-yellow)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
      },
      transitionDuration: { DEFAULT: "200ms" },
    },
  },
  plugins: [],
};

export default config;
