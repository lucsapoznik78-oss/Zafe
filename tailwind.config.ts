import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        foreground: "#F5F5F7",
        primary: {
          DEFAULT: "#7C5CFC",
          foreground: "#ffffff",
          light: "#B9AEFF",
          dark: "#6D4DE8",
        },
        brand: {
          DEFAULT: "#7C5CFC",
          hover: "#8B6DFF",
          active: "#6D4DE8",
          text: "#B9AEFF",
          bg: "#1B1636",
          border: "#3A2E7A",
        },
        secondary: {
          DEFAULT: "#1E1E2A",
          foreground: "#F5F5F7",
        },
        muted: {
          DEFAULT: "#1E1E2A",
          foreground: "#9A9AA8",
        },
        accent: {
          DEFAULT: "#7C5CFC",
          foreground: "#ffffff",
        },
        border: "#232331",
        input: "#1E1E2A",
        card: {
          DEFAULT: "#14141C",
          foreground: "#F5F5F7",
        },
        popover: {
          DEFAULT: "#262636",
          foreground: "#F5F5F7",
        },
        destructive: {
          DEFAULT: "#F43F5E",
          foreground: "#ffffff",
        },
        sim: { DEFAULT: "#22C55E", text: "#4ADE80" },
        nao: { DEFAULT: "#F43F5E", text: "#FB7185" },
        prize: { DEFAULT: "#FBBF24", text: "#FCD34D" },
        surface: { 0: "#0A0A0F", 1: "#14141C", 2: "#1E1E2A", 3: "#262636" },
        line: { DEFAULT: "#232331", strong: "#2E2E3E" },
        ink: { DEFAULT: "#F5F5F7", muted: "#9A9AA8", faint: "#6A6A78" },
        ring: "#7C5CFC",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      keyframes: {
        "confetti-fall": {
          "0%":   { transform: "translateY(-10px) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(350px) rotate(720deg)", opacity: "0" },
        },
        "shimmer-sweep": {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "odds-pulse-up": {
          "0%":   { backgroundColor: "rgba(34, 197, 94, 0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
        "odds-pulse-down": {
          "0%":   { backgroundColor: "rgba(244, 63, 94, 0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "confetti-fall": "confetti-fall 1.8s ease-in forwards",
        "shimmer-sweep": "shimmer-sweep 1.6s ease-in-out 0.3s 2",
        "odds-pulse-up": "odds-pulse-up 1.2s ease-out",
        "odds-pulse-down": "odds-pulse-down 1.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
