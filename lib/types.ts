export type Role = "admin" | "finance" | "membre";
export type Devise = "USD" | "CDF";

export interface Profile {
  id: string; email: string; full_name: string; poste: string | null;
  role: Role; is_active: boolean;
}
export interface Client {
  id: string; denomination: string; contact: string | null; email: string | null;
  phone: string | null; adresse: string | null; rccm: string | null; nif: string | null;
}
export interface Ligne { designation: string; qte: number; pu: number }
export interface Facture {
  id: string; numero: string; client_id: string; objet: string | null;
  date: string; echeance: string; devise: Devise; taux: number;
  lignes: Ligne[];
  /** Ce qu'un humain décide. « En souffrance » et « payée » se calculent. */
  statut: "brouillon" | "emise" | "annulee";
  annulee_motif: string | null;
}

/** Écrit par des triggers en base. L'application ne fait que le lire. */
export interface HistoriqueFacture {
  id: number;
  facture_id: string;
  acteur_nom: string | null;
  action: "creation" | "modification" | "emission" | "annulation" | "encaissement" | "suppression_encaissement";
  detail: Record<string, unknown>;
  at: string;
}
export interface Paiement {
  id: string; facture_id: string; date: string; montant: number;
  devise: Devise; taux: number; compte: string;
}
export type StatutPaiement = "paye" | "a_rembourser" | "rembourse";
export type StatutDepense = "brouillon" | "validee";

export interface Depense {
  id: string; date: string; categorie: string; description: string | null;
  montant: number; devise: Devise; taux: number; compte: string;
  created_by: string | null;
  engage_par: string | null;
  engage_nom: string | null;
  statut_paiement: StatutPaiement;
  rembourse_le: string | null;
  justif_path: string | null;
  justif_nom: string | null;
  statut: StatutDepense;
}
export interface Employe {
  id: string; matricule: string; nom: string; poste: string | null;
  email: string | null; phone: string | null; date_embauche: string;
  salaire: number; devise: Devise; actif: boolean;
  /** Description de poste : ce que la personne fait vraiment. */
  job_description: string | null;
}
export interface Contrat {
  id: string; reference: string; client_id: string; objet: string | null;
  date_debut: string; date_fin: string | null; montant: number; devise: Devise;
  statut: "actif" | "suspendu" | "termine" | "resilie";
  /** Chemin dans le bucket privé, jamais une URL : une URL signée expire. */
  pdf_path: string | null; pdf_nom: string | null;
}
/** Deux responsables au plus, chacun avec son rôle sur le projet. */
export interface Responsable { employe_id: string | null; nom: string; role: string }

export interface Projet {
  id: string; nom: string; client_id: string | null; description: string | null;
  url: string | null; statut: "cadrage" | "en cours" | "livre" | "maintenance" | "en pause";
  echeance: string | null;
  responsables: Responsable[];
}

export type LettreSens = "transmise" | "recue";
export type LettreStatut = "brouillon" | "envoye" | "receptionne";

export interface Lettre {
  id: string; reference: string; sens: LettreSens; objet: string;
  /** Destinataire si transmise, expéditeur si reçue. */
  correspondant: string;
  client_id: string | null;
  date_lettre: string;
  date_envoi: string | null;
  date_reception: string | null;
  porteur: string | null;
  contenu: string | null;
  statut: LettreStatut;
  lettre_path: string | null; lettre_nom: string | null;
  accuse_path: string | null; accuse_nom: string | null;
}

