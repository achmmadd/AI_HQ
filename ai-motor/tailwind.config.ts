import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./design-system/**/*.{js,ts,jsx,tsx,mdx}",
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
      spacing: {
        touch: "var(--ds-touch-min)",
        "touch-comfortable": "var(--ds-touch-comfortable)",
        gutter: "var(--ds-page-gutter)",
        section: "var(--ds-section-gap)",
      },
      borderRadius: {
        ds: "var(--ds-radius-lg)",
        "ds-xl": "var(--ds-radius-xl)",
        "ds-2xl": "var(--ds-radius-2xl)",
      },
      fontSize: {
        display: [
          "var(--ds-text-display-size)",
          {
            lineHeight: "var(--ds-text-display-line)",
            fontWeight: "var(--ds-text-display-weight)",
          },
        ],
        "ds-h1": [
          "var(--ds-text-h1-size)",
          {
            lineHeight: "var(--ds-text-h1-line)",
            fontWeight: "var(--ds-text-h1-weight)",
          },
        ],
        "ds-h2": [
          "var(--ds-text-h2-size)",
          {
            lineHeight: "var(--ds-text-h2-line)",
            fontWeight: "var(--ds-text-h2-weight)",
          },
        ],
        "ds-body": [
          "var(--ds-text-body-size)",
          { lineHeight: "var(--ds-text-body-line)" },
        ],
        caption: [
          "var(--ds-text-caption-size)",
          { lineHeight: "var(--ds-text-caption-line)" },
        ],
      },
      minHeight: {
        touch: "var(--ds-touch-min)",
      },
      minWidth: {
        touch: "var(--ds-touch-min)",
      },
      transitionDuration: { DEFAULT: "var(--ds-duration-default)" },
    },
  },
  plugins: [],
};

export default config;
