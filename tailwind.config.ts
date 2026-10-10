import type { Config } from "tailwindcss";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Every integer percentage is a valid opacity modifier (e.g. bg-primary/12).
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)])),
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: token("card"),
        "card-foreground": token("foreground"),
        muted: token("muted"),
        "muted-foreground": token("muted-foreground"),
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        primary: token("primary"),
        "primary-foreground": token("primary-foreground"),
        accent: token("accent"),
        "accent-foreground": token("accent-foreground"),
        highlight: token("highlight"),
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
        info: token("info"),
        nav: token("nav"),
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" },
      boxShadow: {
        card: "0 1px 2px hsl(var(--shadow) / 0.06), 0 4px 14px hsl(var(--shadow) / 0.06)",
        pop: "0 10px 30px hsl(var(--shadow) / 0.22)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Noto Sans",
          "Noto Sans Devanagari",
          "Nirmala UI",
          "Mangal",
          "sans-serif",
        ],
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "none" } },
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pulse-ring": { "0%": { boxShadow: "0 0 0 0 hsl(var(--danger) / 0.45)" }, "100%": { boxShadow: "0 0 0 14px hsl(var(--danger) / 0)" } },
        sway: { "0%,100%": { transform: "rotate(-1.5deg)" }, "50%": { transform: "rotate(1.5deg)" } },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "fade-in": "fade-in 0.25s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
        "sheet-up": "sheet-up 0.28s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.4s infinite",
        "pulse-ring": "pulse-ring 1.4s infinite",
        sway: "sway 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
