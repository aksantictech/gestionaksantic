import type { supabaseBrowser } from "@/lib/supabase-client";
import type {
  Profile, Client, Facture, Paiement, Depense, Employe, Contrat, Projet, Lettre,
} from "@/lib/types";

/** L'état complet chargé une fois, partagé par tous les écrans. */
export type Data = {
  clients: Client[]; factures: Facture[]; paiements: Paiement[]; depenses: Depense[];
  employes: Employe[]; contrats: Contrat[]; projets: Projet[]; lettres: Lettre[];
  profiles: Profile[]; taux: number;
};

/** Ce que chaque écran reçoit. `ecrire` remonte les refus de la RLS à l'écran. */
export type P = {
  d: Data;
  profil: Profile;
  peutEcrire: boolean;
  ecrire: (op: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>;
  supabase: ReturnType<typeof supabaseBrowser>;
  charger: () => Promise<void>;
};
