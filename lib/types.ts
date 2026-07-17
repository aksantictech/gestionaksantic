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
  lignes: Ligne[]; statut: "brouillon" | "emise";
}
export interface Paiement {
  id: string; facture_id: string; date: string; montant: number;
  devise: Devise; taux: number; compte: string;
}
export interface Depense {
  id: string; date: string; categorie: string; description: string | null;
  montant: number; devise: Devise; taux: number; compte: string;
}
export interface Employe {
  id: string; matricule: string; nom: string; poste: string | null;
  email: string | null; phone: string | null; date_embauche: string;
  salaire: number; devise: Devise; actif: boolean;
}
export interface Contrat {
  id: string; reference: string; client_id: string; objet: string | null;
  date_debut: string; date_fin: string | null; montant: number; devise: Devise;
  statut: "actif" | "suspendu" | "termine" | "resilie";
}
export interface Projet {
  id: string; nom: string; client_id: string | null; description: string | null;
  url: string | null; statut: "cadrage" | "en cours" | "livre" | "maintenance" | "en pause";
}
