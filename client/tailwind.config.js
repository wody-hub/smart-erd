import tailwindcssAnimate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: {
          secondary: "hsl(var(--brand-secondary))",
          "secondary-foreground": "hsl(var(--brand-secondary-foreground))",
          warm: "hsl(var(--accent-warm))",
          "warm-foreground": "hsl(var(--accent-warm-foreground))",
        },
        surface: {
          muted: "hsl(var(--surface-muted))",
          strong: "hsl(var(--surface-strong))",
        },
        ink: {
          secondary: "hsl(var(--foreground-secondary))",
          muted: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        header: {
          DEFAULT: "hsl(var(--header-bg))",
          foreground: "hsl(var(--header-foreground))",
          muted: "hsl(var(--header-muted))",
        },
        composition: {
          "valid-bg": "hsl(var(--composition-valid-bg))",
          "valid-border": "hsl(var(--composition-valid-border))",
          "valid-foreground": "hsl(var(--composition-valid-foreground))",
          "valid-muted": "hsl(var(--composition-valid-muted))",
          "warning-bg": "hsl(var(--composition-warning-bg))",
          "warning-border": "hsl(var(--composition-warning-border))",
          "warning-foreground": "hsl(var(--composition-warning-foreground))",
          "warning-muted": "hsl(var(--composition-warning-muted))",
        },
        erd: {
          "table-header": "hsl(var(--erd-table-header))",
          "table-header-foreground": "hsl(var(--erd-table-header-foreground))",
          pk: "hsl(var(--erd-pk))",
          fk: "hsl(var(--erd-fk))",
          nn: "hsl(var(--erd-nn))",
          ai: "hsl(var(--erd-ai))",
          handle: "hsl(var(--erd-handle))",
          "handle-border": "hsl(var(--erd-handle-border))",
          warning: "hsl(var(--erd-warning))",
          domain: "hsl(var(--erd-domain))",
          "domain-foreground": "hsl(var(--erd-domain-foreground))",
          "validation-matched": "hsl(var(--erd-validation-matched))",
          "validation-mismatch": "hsl(var(--erd-validation-mismatch))",
          "validation-unregistered": "hsl(var(--erd-validation-unregistered))",
          "validation-unchecked": "hsl(var(--erd-validation-unchecked))",
          "status-connected": "hsl(var(--erd-status-connected))",
          "status-connecting": "hsl(var(--erd-status-connecting))",
          "status-disconnected": "hsl(var(--erd-status-disconnected))",
          "cursor-foreground": "hsl(var(--erd-cursor-foreground))",
          "cursor-1": "hsl(var(--cursor-color-1))",
          "cursor-2": "hsl(var(--cursor-color-2))",
          "cursor-3": "hsl(var(--cursor-color-3))",
          "cursor-4": "hsl(var(--cursor-color-4))",
          "cursor-5": "hsl(var(--cursor-color-5))",
          "cursor-6": "hsl(var(--cursor-color-6))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        editorial: "var(--shadow-soft)",
        "editorial-strong": "var(--shadow-strong)",
        operational: "var(--shadow-operational)",
      },
      fontFamily: {
        sans: ['"Pretendard"', '"Noto Sans KR"', "sans-serif"],
        display: ['"Noto Serif KR"', "serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      fontSize: {
        "2xs": ["10px", "14px"],
      },
      keyframes: {
        "collapsible-down": {
          from: { height: "0" },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
