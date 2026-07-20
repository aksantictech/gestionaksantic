import type { supabaseBrowser } from "@/lib/supabase-client";
import type {
  Profile, Client, Facture, Paiement, Depense, Employe, Contrat, Projet, Lettre,
  HistoriqueFacture,
} from "@/lib/types";
import type { Budget } from "@/lib/budget";

/** L'état complet chargé une fois, partagé par tous les écrans. */
export type Data = {
  clients: Client[]; factures: Facture[]; paiements: Paiement[]; depenses: Depense[];
  employes: Employe[]; contrats: Contrat[]; projets: Projet[]; lettres: Lettre[];
  historique: HistoriqueFacture[];
  profiles: Profile[]; budgets: Budget[]; taux: number;
};

/** Ce que chaque écran reçoit. `ecrire` remonte les refus de la RLS à l'écran. */
export type P = {
  d: Data;
  profil: Profile;
  peutEcrire: boolean;
  peutVoirArgent: boolean;
  ecrire: (op: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>;
  supabase: ReturnType<typeof supabaseBrowser>;
  charger: () => Promise<void>;
};
