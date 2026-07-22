-- =============================================================================
-- AKSANTIC — Migration 005
-- Dépenses par les membres · statut de paiement · justificatif obligatoire
-- Mot de passe : chacun change le sien (géré côté Auth, rien ici)
-- =============================================================================
-- Additive et rejouable. Coller dans Supabase → SQL Editor → Run.
-- =============================================================================

-- ------------------------------------------------- 1. Nouvelles colonnes

-- Qui a réellement engagé la dépense (peut différer de created_by si un admin
-- saisit pour quelqu'un). On stocke le nom en dur : si la personne quitte
-- l'entreprise, la dépense reste lisible.
alter table depenses add column if not exists engage_par     uuid references profiles(id);
alter table depenses add column if not exists engage_nom     text;

-- Statut de paiement. « avance » = payé de sa poche, l'entreprise DOIT rembourser.
-- C'est une dette, pas une sortie de trésorerie tant que ce n'est pas remboursé.
alter table depenses add column if not exists statut_paiement text not null default 'paye'
  check (statut_paiement in ('paye', 'a_rembourser', 'rembourse'));
alter table depenses add column if not exists rembourse_le    date;

-- Justificatif (chemin dans le bucket privé documents).
alter table depenses add column if not exists justif_path     text;
alter table depenses add column if not exists justif_nom      text;

-- État de la dépense elle-même : une dépense sans pièce reste en brouillon.
alter table depenses add column if not exists statut text not null default 'brouillon'
  check (statut in ('brouillon', 'validee'));

comment on column depenses.statut_paiement is
  'paye = sortie de caisse effective. a_rembourser = quelqu''un a avancé, dette
   de l''entreprise (n''affecte PAS le solde tant que non remboursée).
   rembourse = la dette a été soldée, devient une sortie réelle à sa date.';

comment on column depenses.statut is
  'brouillon = incomplète (souvent : justificatif manquant). validee = pièce
   jointe et contrôlée. Une dépense ne compte dans les totaux que validée.';

-- ------------------------------------------------- 2. Garde-fou justificatif

-- La règle « aucune dépense sans preuve » est tenue par la BASE, pas par l'écran.
-- On ne peut pas passer une dépense en « validee » sans justif_path.
create or replace function exiger_justificatif()
returns trigger language plpgsql as $$
begin
  if new.statut = 'validee' and (new.justif_path is null or new.justif_path = '') then
    raise exception 'Une dépense validée doit porter une pièce justificative.';
  end if;
  return new;
end $$;

drop trigger if exists trg_justif on depenses;
create trigger trg_justif
  before insert or update on depenses
  for each row execute function exiger_justificatif();

-- ------------------------------------------------- 3. RLS : le membre et SES dépenses

-- Rappel migration-004 : le membre ne voyait AUCUNE dépense. On ouvre une
-- brèche étroite et sûre : il voit et gère UNIQUEMENT les siennes. Jamais celles
-- des autres, jamais la trésorerie globale.

-- Lecture : admin/finance voient tout ; un membre voit ce qu'il a engagé.
drop policy if exists r_fin on depenses;
drop policy if exists depense_lire on depenses;
create policy depense_lire on depenses for select to authenticated
  using (
    can_see_money()
    or engage_par = auth.uid()
    or created_by = auth.uid()
  );

-- Création : tout membre actif peut créer une dépense, mais UNIQUEMENT à son nom.
-- Un membre ne peut pas engager une dépense au nom d'un autre ; admin/finance oui.
drop policy if exists w_fin on depenses;
drop policy if exists depense_creer on depenses;
create policy depense_creer on depenses for insert to authenticated
  with check (
    my_role() is not null
    and (can_see_money() or engage_par = auth.uid())
  );

-- Modification : admin/finance sur tout ; un membre seulement sur SA dépense
-- tant qu'elle n'est pas validée (après validation, elle est figée pour lui).
drop policy if exists u_fin on depenses;
drop policy if exists depense_modifier on depenses;
create policy depense_modifier on depenses for update to authenticated
  using (
    can_see_money()
    or (engage_par = auth.uid() and statut = 'brouillon')
  )
  with check (
    can_see_money()
    or (engage_par = auth.uid() and statut = 'brouillon')
  );

-- Suppression : admin/finance, ou le membre sur son brouillon non validé.
drop policy if exists d_fin on depenses;
drop policy if exists depense_supprimer on depenses;
create policy depense_supprimer on depenses for delete to authenticated
  using (
    can_see_money()
    or (engage_par = auth.uid() and statut = 'brouillon')
  );

-- ------------------------------------------------- 4. Reprise de l'existant

-- Les dépenses déjà là n'ont ni engage_par ni justificatif. On leur attribue
-- leur auteur et leur mode de règlement, mais on les LAISSE EN BROUILLON :
-- les passer en « validee » déclencherait le trigger ci-dessus (pas de pièce
-- jointe), et surtout ce serait mentir sur leur état. Elles apparaîtront comme
-- « incomplètes », ce qu'elles sont, jusqu'à ce que vous y joigniez une pièce.
--
-- On désactive temporairement le trigger le temps de cet UPDATE de reprise,
-- par prudence — même si statut reste 'brouillon', on évite tout effet de bord.
alter table depenses disable trigger trg_justif;

update depenses
set statut_paiement = coalesce(statut_paiement, 'paye'),
    engage_par = coalesce(engage_par, created_by),
    engage_nom = coalesce(engage_nom, (select full_name from profiles where id = depenses.created_by))
where engage_par is null;

alter table depenses enable trigger trg_justif;

-- ⚠️ Vos anciennes dépenses restent en « brouillon » faute de justificatif.
-- Ouvrez-les dans l'application, joignez la pièce, puis validez-les une à une.

-- =============================================================================
-- VÉRIFICATION
-- =============================================================================
-- 1. Un membre voit-il SES dépenses seulement ? (connecté en membre)
--      select description, engage_nom from depenses;  -- que les siennes
--
-- 2. Le justificatif est-il exigé ? (doit lever une exception)
--      insert into depenses (description, montant, statut, engage_par)
--      values ('test', 10, 'validee', auth.uid());
--
-- 3. Le statut de paiement :
--      select description, statut_paiement, rembourse_le from depenses;
-- =============================================================================
