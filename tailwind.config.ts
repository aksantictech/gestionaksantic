import type { Config } from "tailwindcss";

/**
 * Palette extraite du logo (LOGO_AKSANTIC.jpeg), mesurée et non estimée :
 *   #03357E navy      22 %  — le mot AKSANTIC, les hexagones profonds
 *   #4079B2 acier     28 %  — hexagones médians
 *   #74A0C9 ciel      32 %  — hexagones clairs
 *   #C38CD4 orchidée   1 %  — le mot TECHNOLOGY
 *
 * L'orchidée pèse 1 % du fichier et fait 100 % du caractère. C'est la seule
 * couleur chaude d'un logo entièrement froid : on la garde rare et on ne s'en
 * sert que pour désigner (état actif, lien, focus). Jamais pour décorer.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy:     { DEFAULT: "#03357E", 950: "#02224F", 900: "#03357E", 800: "#0F3161", 700: "#2A427E" },
        acier:    { DEFAULT: "#4079B2", 600: "#4079B2", 500: "#5A8CC0" },
        ciel:     { DEFAULT: "#74A0C9", 300: "#74A0C9", 200: "#A9C6E3", 100: "#E3ECF5", 50: "#F5F8FC" },
        orchidee: { DEFAULT: "#C38CD4", 500: "#C38CD4", 400: "#D3A6E0", 600: "#A96CBC" },
      },
      fontFamily: {
        sans:    ["var(--police-corps)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--police-titre)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["var(--police-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      boxShadow: {
        carte: "0 1px 2px 0 rgb(3 53 126 / 0.04), 0 1px 3px 0 rgb(3 53 126 / 0.06)",
        leve:  "0 4px 16px -2px rgb(3 53 126 / 0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
