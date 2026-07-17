import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aksantic — Gestion",
  description: "Gestion administrative et financière d'Aksantic Tech Sarl",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
