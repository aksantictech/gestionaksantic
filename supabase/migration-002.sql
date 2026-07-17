-- =============================================================================
-- AKSANTIC — Migration 002
-- Contrats PDF · Projets (responsables, échéance) · Équipe (matricule auto,
-- description de poste) · Lettres · Stockage de fichiers
-- =============================================================================
-- Additive : ne rejouez PAS schema.sql, votre base contient déjà des données.
-- Coller dans Supabase → SQL Editor → Run.
-- =============================================================================

-- ------------------------------------------------------------ 1. Stockage

-- Bucket PRIVÉ. Un contrat client ou un accusé de réception ne vit pas derrière
-- une URL publique devinable. L'accès se fait par lien signé, à durée limitée.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_lire" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and my_role() is not null);

create policy "documents_deposer" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and my_role() is not null);

create policy "documents_remplacer" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and my_role() is not null);

create policy "documents_supprimer" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and can_see_money());

-- ------------------------------------------------------------ 2. Contrats

alter table contrats add column if not exists pdf_path text;
alter table contrats add column if not exists pdf_nom  text;

comment on column contrats.pdf_path is
  'Chemin dans le bucket documents. Jamais une URL : les URL signées expirent.';

-- ------------------------------------------------------------ 3. Projets

alter table projets add column if not exists echeance date;

-- Deux responsables au plus, chacun avec son rôle sur le projet.
-- jsonb plutôt qu'une table de liaison : on plafonne à deux, et une jointure
-- pour deux lignes coûterait plus cher qu'elle ne rapporte.
alter table projets add column if not exists responsables jsonb not null default '[]'::jsonb;

comment on column projets.responsables is
  'Tableau [{ employe_id, nom, role }], deux entrées maximum.';

-- ------------------------------------------------------------ 4. Équipe

alter table employes add column if not exists job_description text;

-- Matricule généré par la base. Le saisir à la main, c'est se garantir un
-- doublon le jour où deux personnes créent une fiche en même temps.
create sequence if not exists employes_matricule_seq;

select setval(
  'employes_matricule_seq',
  greatest(1, coalesce((
    select max(nullif(regexp_replace(matricule, '\D', '', 'g'), '')::int) from employes
  ), 0)),
  true
);

alter table employes
  alter column matricule
  set default 'AT-' || lpad(nextval('employes_matricule_seq')::text, 3, '0');

-- ------------------------------------------------------------ 5. Lettres

create type lettre_sens as enum ('transmise', 'recue');
create type lettre_statut as enum ('brouillon', 'envoye', 'receptionne');

create table lettres (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  sens          lettre_sens not null,
  objet         text not null,
  correspondant text not null,          -- destinataire si transmise, expéditeur si reçue
  client_id     uuid references clients(id) on delete set null,

  date_lettre   date not null default current_date,
  date_envoi    date,                   -- remise au correspondant
  date_reception date,                  -- accusé obtenu, ou date d'arrivée chez nous
  porteur       text,                   -- qui l'a portée
  contenu       text,

  statut        lettre_statut not null default 'brouillon',

  -- Chemins dans le bucket documents.
  lettre_path   text,
  lettre_nom    text,
  accuse_path   text,
  accuse_nom    text,

  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),

  -- Une lettre envoyée porte forcément sa date d'envoi.
  check (statut <> 'envoye' or date_envoi is not null),
  -- Une lettre réceptionnée porte forcément sa date de réception.
  check (statut <> 'receptionne' or date_reception is not null),
  check (date_envoi is null or date_envoi >= date_lettre),
  check (date_reception is null or date_envoi is null or date_reception >= date_envoi)
);

create index on lettres (sens, statut);
create index on lettres (date_lettre desc);

alter table lettres enable row level security;

create policy lettres_lire on lettres for select to authenticated
  using (my_role() is not null);
create policy lettres_ecrire on lettres for all to authenticated
  using (my_role() is not null) with check (my_role() is not null);

-- Suivi : ce qui est parti et n'est jamais revenu.
create view v_lettres_suivi as
select
  l.*,
  c.denomination as client,
  case
    when l.sens = 'transmise' and l.statut = 'envoye'
      then current_date - l.date_envoi
  end as jours_sans_accuse,
  (l.accuse_path is not null) as accuse_joint
from lettres l
left join clients c on c.id = l.client_id;

-- =============================================================================
-- Vérification rapide après exécution :
--   select matricule from employes order by created_at desc limit 1;
--   insert into employes (nom, poste) values ('Test', 'Test') returning matricule;
--   -- doit renvoyer AT-00X, puis :
--   delete from employes where nom = 'Test';
-- =============================================================================
