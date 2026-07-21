import type { Metadata } from "next";
import { Montserrat, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Trois polices, trois rôles distincts.
 *
 * Montserrat : le mot AKSANTIC du logo est un géométrique lourd. Réservé à la
 *   marque et aux titres. Utilisé partout, il deviendrait pesant.
 * Inter : le corps. Neutre, faite pour être lue sur un écran, pas admirée.
 * JetBrains Mono : les chiffres. Chasse fixe et chiffres tabulaires — dans un
 *   registre, les montants doivent s'aligner à la virgule, sinon on ne compare rien.
 */
const titre = Montserrat({ subsets: ["latin"], weight: ["700", "800"], variable: "--police-titre", display: "swap" });
const corps = Inter({ subsets: ["latin"], variable: "--police-corps", display: "swap" });
const mono  = JetBrains_Mono({ subsets: ["latin"], variable: "--police-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Aksantic Technology — Gestion",
  description: "Gestion administrative et financière d'Aksantic Tech Sarl, Kinshasa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${titre.variable} ${corps.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
