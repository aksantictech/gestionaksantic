-- =============================================================================
-- AKSANTIC — Migration 003
-- Statuts de facture · Historique de modification · Coordonnées société
-- =============================================================================
-- Additive. À exécuter après migration-002.sql.
-- =============================================================================

-- ------------------------------------------------- 1. Statuts de facture
--
-- CE QUI EST STOCKÉ : ce qu'un humain décide.
--   brouillon · emise · annulee
--
-- CE QUI EST CALCULÉ : ce que les faits imposent.
--   « en souffrance » = émise + échéance dépassée + reste dû
--   « payée »         = émise + reste dû nul
--
-- Pourquoi ne PAS les stocker : aucun trigger ne se déclenche quand une date
-- passe. Une facture stockée « émise » deviendrait « en souffrance » sans
-- qu'aucune ligne ne change. Le statut enregistré divergerait des faits, et un
-- jour on relancerait un client qui a payé. On calcule, à chaque lecture.

alter table factures drop constraint if exists factures_statut_check;
alter table factures
  add constraint factures_statut_check
  check (statut in ('brouillon', 'emise', 'annulee'));

alter table factures add column if not exists annulee_motif text;

-- L'état réel, calculé. Une seule définition, en base : l'application et les
-- exports ne peuvent pas en inventer une autre.
--
-- Écrite en PL/pgSQL et non en SQL pur, volontairement. La version précédente
-- faisait « sum(...) * f.taux » dans une même requête : taux n'est ni agrégé ni
-- groupé, Postgres refuse — et il a raison. On sépare donc les étapes au lieu
-- d'ajouter un GROUP BY qui masquerait l'intention.
create or replace function etat_facture(p_facture uuid)
returns text language plpgsql stable as $$
declare
  v_statut   text;
  v_echeance date;
  v_taux     numeric;
  v_du_cdf   numeric;
  v_paye_cdf numeric;
begin
  -- 1. La facture : son statut décidé, son échéance, son montant en CDF.
  select f.statut,
         f.echeance,
         f.taux,
         coalesce((
           select sum((l->>'qte')::numeric * (l->>'pu')::numeric)
           from jsonb_array_elements(f.lignes) l
         ), 0)
    into v_statut, v_echeance, v_taux, v_du_cdf
  from factures f
  where f.id = p_facture;

  if not found then
    return null;
  end if;

  -- La multiplication se fait ici, hors de toute agrégation.
  v_du_cdf := v_du_cdf * v_taux;

  -- 2. Ce qui est décidé prime : inutile de compter les encaissements
  --    d'un brouillon ou d'une facture annulée.
  if v_statut = 'brouillon' then return 'brouillon'; end if;
  if v_statut = 'annulee'   then return 'annulee';   end if;

  -- 3. Ce qui est constaté.
  select coalesce(sum(p.montant * p.taux), 0)
    into v_paye_cdf
  from paiements p
  where p.facture_id = p_facture;

  -- Tolérance d'un franc : les arrondis de conversion ne doivent pas laisser
  -- une facture soldée traîner éternellement en « émise ».
  if v_du_cdf - v_paye_cdf <= 1 then return 'paye'; end if;
  if v_echeance < current_date  then return 'en_souffrance'; end if;

  return 'emise';
end $$;

-- ------------------------------------------------- 2. Historique
--
-- Écrit par des triggers, jamais par l'application : ce qui se contourne ne
-- prouve rien. Personne ne peut modifier une facture sans laisser de trace.

create table if not exists facture_historique (
  id         bigserial primary key,
  facture_id uuid not null references factures(id) on delete cascade,
  acteur_id  uuid references profiles(id),
  acteur_nom text,
  action     text not null,   -- creation | modification | emission | annulation | encaissement | suppression_encaissement
  detail     jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);
create index if not exists idx_hist_facture on facture_historique (facture_id, at desc);

alter table facture_historique enable row level security;

drop policy if exists hist_lire on facture_historique;
create policy hist_lire on facture_historique for select to authenticated
  using (my_role() is not null);
-- Aucune policy d'écriture : seuls les triggers (SECURITY DEFINER) écrivent.

create or replace function qui()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(full_name, email, 'système') from profiles where id = auth.uid();
$$;

create or replace function trace_facture()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_action text; v_detail jsonb := '{}'::jsonb; v_champs jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := case when new.statut = 'emise' then 'emission' else 'creation' end;
    v_detail := jsonb_build_object('numero', new.numero, 'statut', new.statut);
  else
    -- On ne journalise que ce qui a réellement bougé. Un historique qui répète
    -- l'état complet à chaque fois ne se lit pas.
    if old.statut is distinct from new.statut then
      v_champs := v_champs || jsonb_build_object('statut', jsonb_build_array(old.statut, new.statut));
    end if;
    if old.echeance is distinct from new.echeance then
      v_champs := v_champs || jsonb_build_object('echeance', jsonb_build_array(old.echeance, new.echeance));
    end if;
    if old.lignes is distinct from new.lignes then
      v_champs := v_champs || jsonb_build_object('lignes', jsonb_build_array('modifiées', ''));
    end if;
    if old.taux is distinct from new.taux then
      v_champs := v_champs || jsonb_build_object('taux', jsonb_build_array(old.taux, new.taux));
    end if;
    if old.devise is distinct from new.devise then
      v_champs := v_champs || jsonb_build_object('devise', jsonb_build_array(old.devise, new.devise));
    end if;
    if old.objet is distinct from new.objet then
      v_champs := v_champs || jsonb_build_object('objet', jsonb_build_array(old.objet, new.objet));
    end if;
    if old.client_id is distinct from new.client_id then
      v_champs := v_champs || jsonb_build_object('client', jsonb_build_array('changé', ''));
    end if;

    if v_champs = '{}'::jsonb then return new; end if;

    v_action := case
      when old.statut = 'brouillon' and new.statut = 'emise' then 'emission'
      when new.statut = 'annulee' then 'annulation'
      else 'modification'
    end;
    v_detail := jsonb_build_object('champs', v_champs);
  end if;

  insert into facture_historique (facture_id, acteur_id, acteur_nom, action, detail)
  values (new.id, auth.uid(), qui(), v_action, v_detail);
  return new;
end $$;

drop trigger if exists trg_trace_facture on factures;
create trigger trg_trace_facture
  after insert or update on factures
  for each row execute function trace_facture();

create or replace function trace_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into facture_historique (facture_id, acteur_id, acteur_nom, action, detail)
    values (new.facture_id, auth.uid(), qui(), 'encaissement',
      jsonb_build_object('montant', new.montant, 'devise', new.devise,
                         'taux', new.taux, 'compte', new.compte, 'date', new.date));
    return new;
  end if;
  insert into facture_historique (facture_id, acteur_id, acteur_nom, action, detail)
  values (old.facture_id, auth.uid(), qui(), 'suppression_encaissement',
    jsonb_build_object('montant', old.montant, 'devise', old.devise));
  return old;
end $$;

drop trigger if exists trg_trace_paiement on paiements;
create trigger trg_trace_paiement
  after insert or delete on paiements
  for each row execute function trace_paiement();

-- ------------------------------------------------- 3. Coordonnées société

insert into parametres (cle, valeur) values
  ('societe', jsonb_build_object(
    'denomination', 'AKSANTIC TECH Sarl',   -- raison sociale du RCCM, pas le nom d'usage
    'rccm',   'CD/KNM/RCCM/25-B-01605',
    'id_nat', '01-J6100-N66565T',
    'nif',    'A2521568X',
    'adresse','Concession COTEX n°63, Av. Colonel Mondjiba, Q. Basoko, Gombe',
    'ville',  'Kinshasa, RDC',
    'site',   'www.aksantictech.com',
    'email',  'aksantictech@gmail.com',
    'tel',    '+243 812 525 389'
  ))
on conflict (cle) do nothing;

-- =============================================================================
-- VÉRIFICATION — à exécuter après coup, requête par requête
-- =============================================================================
-- 1. La fonction existe et répond :
--      select etat_facture(id), numero, statut from factures;
--
--    « statut » est ce qui est décidé, « etat_facture » ce qui est constaté.
--    Une facture peut être statut='emise' et etat='paye' : c'est normal, et
--    c'est tout l'intérêt.
--
-- 2. L'historique se remplit :
--      select action, acteur_nom, detail, at
--      from facture_historique order by at desc limit 10;
--
-- 3. L'historique refuse d'être réécrit (doit lever une exception) :
--      update facture_historique set action = 'test' where id = 1;
--
-- 4. Les coordonnées sont en place :
--      select valeur from parametres where cle = 'societe';
-- =============================================================================
