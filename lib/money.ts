import type { Devise, Facture, Paiement, Depense } from "./types";

/**
 * Règle unique du système : un montant ne voyage jamais seul.
 * Il porte sa devise et le taux de SA date. Rien ne se recalcule après coup.
 */
export const toCdf = (montant: number, devise: Devise, taux: number) =>
  devise === "CDF" ? Number(montant) : Number(montant) * Number(taux);


/**
 * Une dépense pèse-t-elle sur la trésorerie ?
 *
 * - 'paye'         → oui, l'argent est sorti de la caisse.
 * - 'a_rembourser' → NON. Quelqu'un a avancé de sa poche : c'est une DETTE de
 *                    l'entreprise, pas une sortie. Elle n'entame pas le solde.
 * - 'rembourse'    → oui, la dette a été soldée, l'argent est sorti.
 *
 * Et seule une dépense VALIDÉE (justificatif à l'appui) compte. Un brouillon
 * sans pièce ne fausse pas les totaux.
 */
export function depenseSortieCaisse(x: Depense): boolean {
  return x.statut === "validee" && (x.statut_paiement === "paye" || x.statut_paiement === "rembourse");
}

/** Montant en CDF si — et seulement si — la dépense est une vraie sortie. */
export function depenseSortieCdf(x: Depense): number {
  return depenseSortieCaisse(x) ? toCdf(x.montant, x.devise, x.taux) : 0;
}

/** Ce que l'entreprise doit encore rembourser (dépenses avancées, validées). */
export function depenseARembourser(x: Depense): number {
  return x.statut === "validee" && x.statut_paiement === "a_rembourser"
    ? toCdf(x.montant, x.devise, x.taux) : 0;
}

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

export type EtatCode = "brouillon" | "emise" | "en_souffrance" | "paye" | "annulee";
export type Etat = { code: EtatCode; label: string; tone: "ok" | "late" | "wait" | "muted" };

/**
 * L'état réel d'une facture.
 *
 * Deux des quatre états ne sont PAS stockés, et ne peuvent pas l'être :
 * « en souffrance » dépend de la date du jour — aucun trigger ne se réveille
 * quand une échéance passe — et « payée » dépend de la somme des encaissements.
 * Les stocker, c'est se garantir un jour de relancer un client qui a payé.
 *
 * Miroir exact de la fonction etat_facture() en base (migration-003).
 */
export function etatFacture(f: Facture, paiements: Paiement[]): Etat {
  if (f.statut === "brouillon") return { code: "brouillon", label: "Brouillon", tone: "muted" };
  if (f.statut === "annulee")   return { code: "annulee", label: "Annulée", tone: "muted" };
  if (resteCdf(f, paiements) <= 1) return { code: "paye", label: "Payée", tone: "ok" };
  if (f.echeance < today()) {
    const j = Math.floor((+new Date(today()) - +new Date(f.echeance)) / 86400000);
    return { code: "en_souffrance", label: `En souffrance · ${j} j`, tone: "late" };
  }
  return { code: "emise", label: "Émise", tone: "wait" };
}

/* ------------------------------------------------------- montant en lettres */

const UNITS = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix",
  "onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
const DIZAINES = ["","","vingt","trente","quarante","cinquante","soixante","soixante","quatre-vingt","quatre-vingt"];

/**
 * Un bloc de 0 à 999.
 *
 * `suivi` = ce bloc est-il suivi de « mille » ?
 * Règle française : « cent » et « vingt » multipliés prennent un s quand ils
 * terminent le nombre (deux cents, quatre-vingts), mais le perdent devant
 * « mille » (deux cent mille, quatre-vingt mille). Devant « million » ou
 * « milliard », qui sont des noms, le s revient (deux cents millions).
 * Sur une facture, le montant en lettres fait foi : une faute d'accord rend
 * la pièce contestable.
 */
function centaines(n: number, suivi = false): string {
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    if (d === 7 || d === 9) return DIZAINES[d] + "-" + UNITS[10 + u];
    if (u === 1 && d !== 8) return DIZAINES[d] + " et un";
    if (u) return DIZAINES[d] + "-" + UNITS[u];
    return DIZAINES[d] + (d === 8 && !suivi ? "s" : "");
  }
  const c = Math.floor(n / 100), r = n % 100;
  if (r) return (c === 1 ? "cent" : UNITS[c] + " cent") + " " + centaines(r, suivi);
  return c === 1 ? "cent" : UNITS[c] + " cent" + (suivi ? "" : "s");
}

/** « Deux mille six cent cinquante dollars américains ». */
export function montantEnLettres(n: number, devise: Devise): string {
  const entier = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - entier) * 100);

  const dire = (x: number): string => {
    if (x === 0) return "zéro";
    const parts: string[] = [];
    let reste = x;

    // suivi=true seulement devant « mille » : million et milliard sont des noms.
    const tranches: [number, string, string, boolean][] = [
      [1_000_000_000, "milliard", "milliards", false],
      [1_000_000, "million", "millions", false],
      [1_000, "mille", "mille", true],
    ];

    for (const [val, sing, plur, suivi] of tranches) {
      const q = Math.floor(reste / val);
      if (q > 0) {
        parts.push(
          q === 1 && val === 1000 ? "mille" : `${centaines(q, suivi)} ${q > 1 ? plur : sing}`,
        );
        reste %= val;
      }
    }
    if (reste > 0) parts.push(centaines(reste));
    return parts.join(" ");
  };

  const nom = devise === "USD" ? "dollars américains" : "francs congolais";
  const sub = devise === "USD" ? "cents" : "centimes";
  const t = `${dire(entier)} ${nom}`;
  return (cents > 0 ? `${t} et ${dire(cents)} ${sub}` : t).replace(/^./, (c) => c.toUpperCase());
}

export const SOCIETE_CONTACT = {
  site: "www.aksantictech.com",
  email: "aksantictech@gmail.com",
  tel: "+243 812 525 389",
};

export const SOCIETE = {
  // La raison sociale du RCCM, et elle seule. « Aksantic Technology » est le nom
  // d'usage porté par le logo ; sur une facture, c'est la dénomination légale
  // qui engage la société et qui doit figurer.
  denomination: "AKSANTIC TECH Sarl",
  nomUsage: "AKSANTIC TECHNOLOGY",
  sigle: "AT",
  rccm: "CD/KNM/RCCM/25-B-01605",
  idNat: "01-J6100-N66565T",
  nif: "A2521568X",
  siege: "Concession COTEX n°63, Av. Colonel Mondjiba, Q. Basoko, Gombe",
  ville: "Kinshasa, RDC",
};
