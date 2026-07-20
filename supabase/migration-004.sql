-- =============================================================================
-- AKSANTIC — Migration 004
-- Cloisonnement financier des membres · Module Budget prévisionnel
-- =============================================================================
-- Additive et rejouable. Coller dans Supabase → SQL Editor → Run.
-- =============================================================================

-- ============================================================================
-- PARTIE 1 — Le membre ne voit plus rien de financier
-- ============================================================================
-- Jusqu'ici, un « membre » pouvait LIRE les factures, paiements et dépenses.
-- C'était un trou : masquer l'onglet ne protège pas la donnée. On resserre la
-- RLS pour que finance et dépenses soient réservés à admin + finance.
--
-- Rappel du partage :
--   admin, finance → tout le financier
--   membre         → clients, contrats, projets, lettres (activité, pas argent)

-- Les anciennes policies « lecture pour tout membre actif » sautent.
drop policy if exists r_all on factures;
drop policy if exists r_all on paiements;
drop policy if exists r_all on depenses;

-- Lecture désormais réservée à ceux qui peuvent voir l'argent.
create policy r_fin on factures  for select to authenticated using (can_see_money());
create policy r_fin on paiements for select to authenticated using (can_see_money());
create policy r_fin on depenses  for select to authenticated using (can_see_money());

-- Écriture : déjà réservée à can_see_money() en migration 001. On s'assure
-- qu'aucune policy trop permissive ne subsiste.
drop policy if exists w_fin on factures;
drop policy if exists u_fin on factures;
drop policy if exists d_fin on factures;
create policy w_fin on factures for insert to authenticated with check (can_see_money());
create policy u_fin on factures for update to authenticated using (can_see_money()) with check (can_see_money());
create policy d_fin on factures for delete to authenticated using (can_see_money());

drop policy if exists w_fin on paiements;
drop policy if exists u_fin on paiements;
drop policy if exists d_fin on paiements;
create policy w_fin on paiements for insert to authenticated with check (can_see_money());
create policy u_fin on paiements for update to authenticated using (can_see_money()) with check (can_see_money());
create policy d_fin on paiements for delete to authenticated using (can_see_money());

drop policy if exists w_fin on depenses;
drop policy if exists u_fin on depenses;
drop policy if exists d_fin on depenses;
create policy w_fin on depenses for insert to authenticated with check (can_see_money());
create policy u_fin on depenses for update to authenticated using (can_see_money()) with check (can_see_money());
create policy d_fin on depenses for delete to authenticated using (can_see_money());

-- Paramètres : lecture réservée elle aussi (le taux de change est une donnée
-- financière, et l'écran Paramètres devient interdit aux membres).
drop policy if exists par_read on parametres;
create policy par_read on parametres for select to authenticated using (can_see_money());

-- L'historique des factures suit la même logique.
drop policy if exists hist_lire on facture_historique;
create policy hist_lire on facture_historique for select to authenticated using (can_see_money());

-- ============================================================================
-- PARTIE 2 — Budget prévisionnel (d'après le classeur Excel)
-- ============================================================================
-- Le classeur pilote tout par hypothèses : salaires, croissance, taux d'impôt,
-- inflation. On stocke ces hypothèses, l'application déroule la projection.
--
-- Choix de conception : on NE stocke PAS les 12 mois calculés. Ils se déduisent
-- des hypothèses à chaque affichage — exactement comme les formules du tableur.
-- Stocker le résultat, c'est risquer qu'il diverge des hypothèses dès qu'on en
-- change une seule. Une source de vérité : les hypothèses.

create table if not exists budgets (
  id           uuid primary key default gen_random_uuid(),
  annee        int not null,
  libelle      text not null default 'Prévisionnel',
  devise       text not null default 'USD' check (devise in ('USD', 'CDF')),

  -- Toutes les hypothèses du classeur, en un seul jsonb versionnable.
  hypotheses   jsonb not null default '{}'::jsonb,

  -- Postes de charges fixes mensuelles : [{ libelle, montant }]
  charges_fixes jsonb not null default '[]'::jsonb,

  actif        boolean not null default true,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (annee, libelle)
);

alter table budgets enable row level security;

-- Le budget est une donnée financière : admin + finance uniquement.
drop policy if exists budget_lire on budgets;
create policy budget_lire on budgets for select to authenticated using (can_see_money());
drop policy if exists budget_ecrire on budgets;
create policy budget_ecrire on budgets for all to authenticated
  using (can_see_money()) with check (can_see_money());

-- Un budget de départ, repris des hypothèses du classeur transmis.
-- ⚠️ Note honnête reprise du fichier : l'IPR (15 %) y est annoncé mais n'est PAS
-- appliqué au calcul de masse salariale — seules les charges patronales (17 %)
-- le sont. On garde le même périmètre pour rester cohérent avec votre modèle,
-- mais votre masse salariale réelle sera plus lourde (voir champ ipr ci-dessous,
-- à activer quand vous voudrez le corriger).
insert into budgets (annee, libelle, devise, hypotheses, charges_fixes)
values (
  extract(year from current_date)::int,
  'Prévisionnel — repris du classeur',
  'USD',
  jsonb_build_object(
    'ca_depart_mensuel', 5000,
    'croissance_mensuelle', 0.03,
    'croissance_annuelle', 0.10,
    'salaires', jsonb_build_array(750, 500, 100),
    'charges_patronales', 0.17,
    'ipr', 0.15,
    'ipr_actif', false,
    'augmentation_salariale_annuelle', 0.02,
    'inflation_charges_annuelle', 0.03,
    'taux_is', 0.15
  ),
  jsonb_build_array(
    jsonb_build_object('libelle', 'Loyer et charges locatives', 'montant', 500),
    jsonb_build_object('libelle', 'Honoraires comptables', 'montant', 250),
    jsonb_build_object('libelle', 'Télécom / Internet', 'montant', 0),
    jsonb_build_object('libelle', 'Logiciels et abonnements', 'montant', 0),
    jsonb_build_object('libelle', 'Fournitures de bureau', 'montant', 100),
    jsonb_build_object('libelle', 'Frais bancaires', 'montant', 20),
    jsonb_build_object('libelle', 'Déplacements et représentation', 'montant', 50),
    jsonb_build_object('libelle', 'Marketing et communication', 'montant', 50),
    jsonb_build_object('libelle', 'Divers et imprévus', 'montant', 180)
  )
)
on conflict (annee, libelle) do nothing;

-- =============================================================================
-- VÉRIFICATION
-- =============================================================================
-- 1. Un membre ne voit plus le financier. Connecté en membre :
--      select * from factures;   -- doit renvoyer 0 ligne (pas une erreur : 0 ligne)
--
-- 2. Le budget existe :
--      select annee, libelle, hypotheses->>'ca_depart_mensuel' from budgets;
-- =============================================================================
