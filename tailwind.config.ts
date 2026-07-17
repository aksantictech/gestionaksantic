import type { Config } from "tailwindcss";

/**
 * Palette extraite du logo (LOGO_AKSANTIC.jpeg), pas estimée à l'œil :
 *   #03357E navy   22 %   ·   #4079B2 acier  28 %
 *   #74A0C9 ciel   32 %   ·   #FFFFFF blanc  71 %
 * La marque est bleue sur blanc. L'interface l'est aussi.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: "#03357E", 900: "#03357E", 800: "#0F3161", 700: "#2A427E" },
        acier: { DEFAULT: "#4079B2", 600: "#4079B2", 500: "#5A8CC0" },
        ciel:  { DEFAULT: "#74A0C9", 300: "#74A0C9", 100: "#E3ECF5", 50: "#F4F8FC" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
