-- =============================================================================
-- AKSANTIC — Base de données (version simple, mais réelle)
-- À coller dans Supabase → SQL Editor → Run
-- =============================================================================
-- Choix assumés pour tenir le délai :
--   • Mono-société. Pas de org_id. Le multi-tenant est dans le CDC, pour plus tard.
--   • Pas de TVA, pas de DEF, pas de SYSCOHADA.
--   • Le taux de change reste figé sur chaque opération. Non négociable :
--     c'est ce qui coûte une semaine à rattraper si on l'omet.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- comptes

create type app_role as enum ('admin', 'finance', 'membre');

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  poste      text default '',
  role       app_role not null default 'membre',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Le profil se crée tout seul à l'inscription : pas de compte orphelin.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::app_role, 'membre')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function my_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'admin', false);
$$;

create or replace function can_see_money()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('admin', 'finance'), false);
$$;

-- ---------------------------------------------------------------- métier

create table clients (
  id           uuid primary key default gen_random_uuid(),
  denomination text not null,
  contact      text,
  email        text,
  phone        text,
  adresse      text,
  rccm         text,
  nif          text,
  created_at   timestamptz not null default now()
);

create table factures (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null unique,
  client_id  uuid not null references clients(id) on delete restrict,
  objet      text,
  date       date not null default current_date,
  echeance   date not null,
  -- Invariant : la devise ET le taux de la date d'émission voyagent ensemble.
  devise     text not null default 'USD' check (devise in ('USD', 'CDF')),
  taux       numeric(14,4) not null default 1 check (taux > 0),
  lignes     jsonb not null default '[]'::jsonb,
  statut     text not null default 'brouillon' check (statut in ('brouillon', 'emise')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (echeance >= date),
  check (devise <> 'CDF' or taux = 1)
);
create index on factures (client_id);
create index on factures (statut, echeance);

create table paiements (
  id         uuid primary key default gen_random_uuid(),
  facture_id uuid not null references factures(id) on delete cascade,
  date       date not null default current_date,
  montant    numeric(16,2) not null check (montant > 0),
  -- Le taux de l'encaissement diffère souvent de celui de la facture.
  -- C'est normal. On l'enregistre au lieu de le lisser.
  devise     text not null check (devise in ('USD', 'CDF')),
  taux       numeric(14,4) not null check (taux > 0),
  compte     text not null default 'Banque USD',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (devise <> 'CDF' or taux = 1)
);
create index on paiements (facture_id);

create table depenses (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  categorie   text not null default 'Autre',
  description text,
  montant     numeric(16,2) not null check (montant > 0),
  devise      text not null default 'USD' check (devise in ('USD', 'CDF')),
  taux        numeric(14,4) not null default 1 check (taux > 0),
  compte      text not null default 'Caisse',
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  check (devise <> 'CDF' or taux = 1)
);
create index on depenses (date desc);

create table employes (
  id            uuid primary key default gen_random_uuid(),
  matricule     text not null unique,
  nom           text not null,
  poste         text,
  email         text,
  phone         text,
  date_embauche date not null default current_date,
  salaire       numeric(16,2) not null default 0,
  devise        text not null default 'USD' check (devise in ('USD', 'CDF')),
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

create table contrats (
  id         uuid primary key default gen_random_uuid(),
  reference  text not null unique,
  client_id  uuid not null references clients(id) on delete restrict,
  objet      text,
  date_debut date not null default current_date,
  date_fin   date,
  montant    numeric(16,2) not null default 0,
  devise     text not null default 'USD' check (devise in ('USD', 'CDF')),
  statut     text not null default 'actif' check (statut in ('actif','suspendu','termine','resilie')),
  created_at timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);

create table projets (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  client_id   uuid references clients(id) on delete set null,
  description text,
  url         text,
  statut      text not null default 'en cours'
              check (statut in ('cadrage','en cours','livre','maintenance','en pause')),
  created_at  timestamptz not null default now()
);

create table parametres (
  cle        text primary key,
  valeur     jsonb not null,
  updated_at timestamptz not null default now()
);
insert into parametres (cle, valeur) values ('taux_usd_cdf', '2900'::jsonb);

-- ---------------------------------------------------------------- RLS

alter table profiles   enable row level security;
alter table clients    enable row level security;
alter table factures   enable row level security;
alter table paiements  enable row level security;
alter table depenses   enable row level security;
alter table employes   enable row level security;
alter table contrats   enable row level security;
alter table projets    enable row level security;
alter table parametres enable row level security;

-- Profils : chacun voit l'équipe, seul l'admin modifie.
create policy p_read   on profiles for select to authenticated using (true);
create policy p_self   on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = my_role());
create policy p_admin  on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- Données commerciales : tout membre actif lit et écrit.
do $$
declare t text;
begin
  foreach t in array array['clients','contrats','projets'] loop
    execute format(
      'create policy rw on %I for all to authenticated
         using (my_role() is not null) with check (my_role() is not null)', t);
  end loop;
end $$;

-- Argent : lecture pour tous les membres actifs, écriture réservée admin/finance.
do $$
declare t text;
begin
  foreach t in array array['factures','paiements','depenses'] loop
    execute format('create policy r_all on %I for select to authenticated
                      using (my_role() is not null)', t);
    execute format('create policy w_fin on %I for insert to authenticated
                      with check (can_see_money())', t);
    execute format('create policy u_fin on %I for update to authenticated
                      using (can_see_money()) with check (can_see_money())', t);
    execute format('create policy d_fin on %I for delete to authenticated
                      using (can_see_money())', t);
  end loop;
end $$;

-- Salaires : admin et finance uniquement. Chacun peut voir sa propre fiche.
create policy e_read on employes for select to authenticated
  using (can_see_money() or email = (select email from profiles where id = auth.uid()));
create policy e_write on employes for all to authenticated
  using (can_see_money()) with check (can_see_money());

create policy par_read  on parametres for select to authenticated using (my_role() is not null);
create policy par_write on parametres for all to authenticated
  using (can_see_money()) with check (can_see_money());

-- ---------------------------------------------------------------- vues

create view v_factures_soldes as
select
  f.*,
  c.denomination as client,
  (select coalesce(sum((l->>'qte')::numeric * (l->>'pu')::numeric), 0)
     from jsonb_array_elements(f.lignes) l) as total,
  (select coalesce(sum((l->>'qte')::numeric * (l->>'pu')::numeric), 0)
     from jsonb_array_elements(f.lignes) l) * f.taux as total_cdf,
  coalesce((select sum(p.montant * p.taux) from paiements p where p.facture_id = f.id), 0) as paye_cdf
from factures f
join clients c on c.id = f.client_id;

-- =============================================================================
-- APRÈS EXÉCUTION — créer le premier admin
-- =============================================================================
-- 1. Authentication → Users → Add user → email + mot de passe → "Auto Confirm"
-- 2. Puis, en remplaçant l'adresse :
--
--      update profiles set role = 'admin' where email = 'tite@aksantictech.com';
--
-- Ce compte pourra ensuite créer les autres depuis l'onglet Admin.
-- =============================================================================
