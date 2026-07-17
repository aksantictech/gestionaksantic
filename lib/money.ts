import type { Devise, Facture, Paiement } from "./types";

/**
 * Règle unique du système : un montant ne voyage jamais seul.
 * Il porte sa devise et le taux de SA date. Rien ne se recalcule après coup.
 */
export const toCdf = (montant: number, devise: Devise, taux: number) =>
  devise === "CDF" ? Number(montant) : Number(montant) * Number(taux);

export const fmt = (n: number, devise: Devise | "CDF" = "CDF") =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: devise === "USD" ? 2 : 0,
    maximumFractionDigits: devise === "USD" ? 2 : 0,
  }).format(Number(n) || 0);

export const dateFr = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR",
      { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const today = () => new Date().toISOString().slice(0, 10);

export const totalFacture = (f: Facture) =>
  (f.lignes || []).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu || 0), 0);

export const payeCdf = (paiements: Paiement[]) =>
  paiements.reduce((s, p) => s + toCdf(p.montant, p.devise, p.taux), 0);

export const resteCdf = (f: Facture, paiements: Paiement[]) =>
  toCdf(totalFacture(f), f.devise, f.taux) - payeCdf(paiements);

export type Etat = { label: string; tone: "ok" | "late" | "wait" | "muted" };

export function etatFacture(f: Facture, paiements: Paiement[]): Etat {
  if (f.statut === "brouillon") return { label: "Brouillon", tone: "muted" };
  if (resteCdf(f, paiements) <= 1) return { label: "Payée", tone: "ok" };
  if (f.echeance < today()) {
    const j = Math.floor((+new Date(today()) - +new Date(f.echeance)) / 86400000);
    return { label: `En retard · ${j} j`, tone: "late" };
  }
  return { label: "En attente", tone: "wait" };
}

export const SOCIETE = {
  denomination: "AKSANTIC TECH Sarl",
  sigle: "AT",
  rccm: "CD/KNM/RCCM/25-B-01605",
  idNat: "01-J6100-N66565T",
  nif: "A2521568X",
  siege: "Concession COTEX n°63, Av. Colonel Mondjiba, Q. Basoko, Gombe",
  ville: "Kinshasa, RDC",
};
