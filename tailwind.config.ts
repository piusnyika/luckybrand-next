import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "16px", lg: "40px" }, screens: { "2xl": "1360px" } },
    extend: {
      colors: {
        primary: { DEFAULT: "#004798", 50: "#e6edf5", 100: "#ccdaea", 600: "#003d82", 700: "#00336d" },
        brand: { DEFAULT: "#3e4095", 600: "#34367f" },
        accent: "#f9d309",
        notice: "#ed1b24",
        ink: { DEFAULT: "#1b1f22", soft: "#5b5d67", muted: "#737582" },
        line: "#dfe2e6",
        surface: "#f8f9fa",
        success: "#40c057",
        danger: "#e53e3e",
      },
      fontFamily: { sans: ["var(--font-satoshi)", "system-ui", "sans-serif"] },
      borderRadius: { base: "10px", form: "8px" },
      letterSpacing: { tightish: "-0.01em" },
      maxWidth: { site: "1360px" },
      keyframes: { "toast-in": { from: { opacity: "0", transform: "translateY(-8px) scale(.98)" }, to: { opacity: "1", transform: "none" } } },
      animation: { "toast-in": "toast-in .2s ease-out" },
    },
  },
  plugins: [],
} satisfies Config;
