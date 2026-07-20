import type { Devise } from "./types";

/**
 * Moteur de projection budgétaire.
 *
 * Rejoue la logique du classeur Excel « Prévisions_Budgetaires » : à partir des
 * hypothèses, on déroule 12 mois puis 3 ans. Rien n'est stocké — tout se
 * recalcule, comme les formules du tableur. Une seule source de vérité : les
 * hypothèses.
 *
 * ⚠️ Fidélité au modèle d'origine : l'IPR (impôt sur salaires) est prévu mais
 * désactivé par défaut, car le classiseur ne l'appliquait pas à la masse
 * salariale. Activez `ipr_actif` pour une masse salariale plus réaliste — elle
 * sera alors plus lourde que votre prévisionnel initial.
 */

export interface Hypotheses {
  ca_depart_mensuel: number;
  croissance_mensuelle: number;         // ex : 0.03 = +3 %/mois
  croissance_annuelle: number;          // années 2 et 3
  salaires: number[];                   // salaires bruts mensuels
  charges_patronales: number;           // ex : 0.17
  ipr: number;                          // ex : 0.15
  ipr_actif: boolean;
  augmentation_salariale_annuelle: number;
  inflation_charges_annuelle: number;
  taux_is: number;                      // impôt sociétés
}

export interface ChargeFixe { libelle: string; montant: number }

export interface Budget {
  id: string;
  annee: number;
  libelle: string;
  devise: Devise;
  hypotheses: Hypotheses;
  charges_fixes: ChargeFixe[];
  actif: boolean;
}

export interface MoisProjete {
  index: number;
  label: string;
  ca: number;
  salairesBruts: number;
  chargesPatronales: number;
  ipr: number;
  masseSalariale: number;
  chargesExploitation: number;
  totalCharges: number;
  ebe: number;              // résultat d'exploitation
  is: number;               // impôt sociétés
  resultatNet: number;
  tresorerieCumulee: number;
}

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

/** Déroule les 12 mois de l'année 1, à la manière de l'onglet Budget Mensuel. */
export function projeter12Mois(h: Hypotheses, charges: ChargeFixe[]): MoisProjete[] {
  const salairesBruts = h.salaires.reduce((s, x) => s + x, 0);
  const chargesPatronales = salairesBruts * h.charges_patronales;
  const ipr = h.ipr_actif ? salairesBruts * h.ipr : 0;
  const masseSalariale = salairesBruts + chargesPatronales + ipr;
  const chargesExploitation = charges.reduce((s, c) => s + Number(c.montant || 0), 0);
  const totalCharges = masseSalariale + chargesExploitation;

  let cumul = 0;
  return MOIS.map((label, i) => {
    const ca = h.ca_depart_mensuel * Math.pow(1 + h.croissance_mensuelle, i);
    const ebe = ca - totalCharges;
    const is = ebe > 0 ? ebe * h.taux_is : 0;
    const resultatNet = ebe - is;
    cumul += resultatNet;
    return {
      index: i, label, ca, salairesBruts, chargesPatronales, ipr, masseSalariale,
      chargesExploitation, totalCharges, ebe, is, resultatNet, tresorerieCumulee: cumul,
    };
  });
}

export interface AnneeProjetee {
  annee: number;
  ca: number;
  masseSalariale: number;
  chargesExploitation: number;
  totalCharges: number;
  ebe: number;
  is: number;
  resultatNet: number;
  margeNette: number;
}

/** Projette 3 ans, à la manière de l'onglet Budget Annuel. */
export function projeter3Ans(h: Hypotheses, charges: ChargeFixe[]): AnneeProjetee[] {
  const mois1 = projeter12Mois(h, charges);
  const an1 = {
    ca: mois1.reduce((s, m) => s + m.ca, 0),
    masseSalariale: mois1[0].masseSalariale * 12,
    chargesExploitation: mois1[0].chargesExploitation * 12,
  };

  const annees: AnneeProjetee[] = [];
  let ca = an1.ca, masse = an1.masseSalariale, charg = an1.chargesExploitation;

  for (let a = 1; a <= 3; a++) {
    if (a > 1) {
      ca *= 1 + h.croissance_annuelle;
      masse *= 1 + h.augmentation_salariale_annuelle;
      charg *= 1 + h.inflation_charges_annuelle;
    }
    const totalCharges = masse + charg;
    const ebe = ca - totalCharges;
    const is = ebe > 0 ? ebe * h.taux_is : 0;
    const resultatNet = ebe - is;
    annees.push({
      annee: a, ca, masseSalariale: masse, chargesExploitation: charg,
      totalCharges, ebe, is, resultatNet,
      margeNette: ca > 0 ? resultatNet / ca : 0,
    });
  }
  return annees;
}

/** Le prévu du mois, converti dans la devise de comparaison (le réel est en CDF). */
export function prevuMoisCdf(b: Budget, moisIndex: number, tauxUsdCdf: number): {
  caPrevuCdf: number; chargesPrevuCdf: number;
} {
  const mois = projeter12Mois(b.hypotheses, b.charges_fixes)[moisIndex];
  const enCdf = (v: number) => (b.devise === "CDF" ? v : v * tauxUsdCdf);
  return {
    caPrevuCdf: enCdf(mois.ca),
    chargesPrevuCdf: enCdf(mois.totalCharges),
  };
}

export const HYPOTHESES_DEFAUT: Hypotheses = {
  ca_depart_mensuel: 5000, croissance_mensuelle: 0.03, croissance_annuelle: 0.10,
  salaires: [750, 500, 100], charges_patronales: 0.17, ipr: 0.15, ipr_actif: false,
  augmentation_salariale_annuelle: 0.02, inflation_charges_annuelle: 0.03, taux_is: 0.15,
};
