# Aksantic — Gestion

Application de gestion d'entreprise : clients, factures, encaissements, dépenses,
contrats, équipe, projets. Vraie base de données PostgreSQL, vraie authentification,
comptes créés par un administrateur avec de vraies adresses email.

**Stack** — Next.js 15 · Supabase (Postgres + Auth) · Tailwind · TypeScript
**Déploiement** — Vercel

---

## Mise en route (~20 min)

### 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project**
2. Région : la plus proche (Frankfurt ou Londres depuis Kinshasa)
3. Notez le mot de passe de la base

### 2. Créer les tables

**SQL Editor** → **New query** → coller tout `supabase/schema.sql` → **Run**.

Puis, dans une nouvelle requête, coller `supabase/migration-002.sql` → **Run**.
Elle ajoute : PDF des contrats, responsables et échéance des projets, matricule
généré automatiquement, description de poste, module Lettres, et le bucket de
fichiers.

> Si votre base tourne déjà, ne rejouez **que** `migration-002.sql`, puis `migration-003.sql`, puis `migration-004.sql`, dans l'ordre. Elle est
> additive et ne touche à aucune donnée existante.

### 3. Créer le premier administrateur

**Authentication → Users → Add user**
- Email : votre adresse réelle
- Mot de passe : solide
- Cocher **Auto Confirm User**

Puis, dans le **SQL Editor** :

```sql
update profiles set role = 'admin' where email = 'votre.adresse@aksantictech.com';
```

Ce compte créera tous les autres depuis l'onglet **Admin** de l'application.

### 4. Configurer l'application

```bash
cp .env.local.example .env.local
```

Remplissez avec **Project Settings → API** :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role — **secret** |

> La clé `service_role` contourne toutes les règles de sécurité. Elle ne porte
> jamais le préfixe `NEXT_PUBLIC_`, ne part jamais dans le navigateur, et ne va
> jamais dans Git. Elle sert uniquement à créer des comptes côté serveur.

### 5. Lancer

```bash
npm install
npm run dev
```

→ [localhost:3000](http://localhost:3000)

### 6. Déployer

```bash
npx vercel
```

Reportez les trois variables d'environnement dans **Vercel → Settings →
Environment Variables**. Sans elles, le build passe et l'application échoue au
premier chargement.

---

## Rôles

| Rôle | Peut faire |
|---|---|
| `admin` | Tout, y compris créer, désactiver et changer le rôle des comptes |
| `finance` | Tout le financier : synthèse, budget, factures, encaissements, dépenses, salaires, taux |
| `membre` | **Activité commerciale seule** : clients, contrats, projets, lettres. Aucun accès au financier, aux salaires, ni aux paramètres. |

Depuis `migration-004`, le cloisonnement du membre est appliqué **dans PostgreSQL** (RLS) et pas seulement dans l'interface : un membre qui interrogerait l'API directement recevrait zéro ligne sur les factures, paiements et dépenses.

## Budget prévisionnel

Le module Budget reprend la logique de votre classeur Excel : des hypothèses (CA de départ, croissance, salaires, charges, taux d'impôt) déroulent une projection sur 12 mois et 3 ans. Rien n'est figé — tout se recalcule depuis les hypothèses.

L'onglet **Prévu vs réel** est le cœur : il place la projection en regard de vos factures et dépenses réelles, mois par mois, avec l'écart en pourcentage. C'est ce qu'aucun tableur ne peut faire, puisque le tableur ne connaît pas vos factures.

> ⚠️ Repris fidèlement du classeur : l'IPR (impôt sur salaires, 15 %) est **désactivé par défaut**, car le fichier d'origine ne l'appliquait pas à la masse salariale. Votre masse réelle sera donc plus lourde que ce prévisionnel. Cochez « Appliquer l'IPR » dans les hypothèses pour un plan plus prudent.

Ces règles vivent dans PostgreSQL (Row Level Security), pas dans l'interface.
Masquer un bouton n'a jamais protégé une donnée : ici, un `membre` qui appellerait
l'API directement se ferait refuser par la base.

---

## Ce qui est dedans

- Connexion par email et mot de passe, session persistante
- Création de comptes par un administrateur, avec mot de passe provisoire généré
- Désactivation d'un compte sans le supprimer (l'historique reste lisible)
- Clients, factures multi-lignes, encaissements partiels, relance visuelle des retards
- Dépenses par catégorie et par compte
- Contrats avec alerte d'échéance à 45 jours
- Équipe et masse salariale
- Projets
- Registre : un fil chronologique unique de tout ce qui bouge
- Synthèse : indicateurs, six derniers mois, principaux clients, postes de dépense, délai moyen d'encaissement
- Lettres transmises et reçues, avec accusé de réception et suivi des relances
- Fichiers (contrats, lettres, accusés) dans un bucket **privé**, accès par lien signé

## Ce qui n'y est pas — assumé

| Manque | Pourquoi | Quand |
|---|---|---|
| TVA, facture normalisée, DEF/e-DEF | Écarté à votre demande | Après clarification du régime avec la DGI |
| Comptabilité SYSCOHADA | Hors périmètre | Grande version |
| Génération PDF des factures | Non tenable dans le délai | **Prochain ajout le plus rentable** |
| Recherche plein texte dans les lettres | — | Grande version |
| Multi-société | Une seule société pour l'instant | Le CDC prévoit `org_id` partout |
| Journal d'audit | — | Grande version |
| Réinitialisation de mot de passe par email | Demande un SMTP configuré | Un admin le change depuis l'onglet Admin |

---

## Le point à ne pas casser

Chaque facture, chaque encaissement et chaque dépense **conserve le taux USD/CDF
de sa propre date**. Modifier le taux dans Paramètres ne réécrit pas le passé.

C'est la seule exigence de la grande version que j'ai refusé de couper. Une base
qui ne stocke qu'un montant sans son taux devient fausse en quelques mois, et la
rattraper coûte une semaine. La garder coûte zéro aujourd'hui.

---

## Sauvegardes

Supabase sauvegarde quotidiennement (plan gratuit : 7 jours de rétention).
Testez une restauration avant d'en avoir besoin — une sauvegarde jamais restaurée
n'est pas une sauvegarde.


---

## En cas de blocage

### Le bouton « Connexion » tourne indéfiniment

Trois causes, par ordre de fréquence :

1. **Variables d'environnement absentes sur Vercel.** `.env.local` est dans
   `.gitignore` : il ne part jamais. Recopiez les trois variables dans
   **Vercel → Settings → Environment Variables**, pour Production **et** Preview,
   puis **redéployez** — un changement de variable ne s'applique pas au
   déploiement en cours.
2. **Cookies perdus à la redirection.** Corrigé dans `middleware.ts` : toute
   redirection recopie les cookies posés par le rafraîchissement de session.
   Si vous aviez une version antérieure, c'était la cause.
3. **Compte désactivé ou profil absent.** Vérifiez :
   ```sql
   select email, role, is_active from profiles;
   ```
   Si la ligne manque, le trigger `handle_new_user` n'a pas tourné : créez-la à
   la main, puis passez le rôle à `admin`.

Ouvrez la console du navigateur (F12) : depuis la correction, toute erreur
s'affiche à l'écran et se journalise. Un écran muet est un écran cassé.

### L'application est lente

- **Région Supabase.** Depuis Kinshasa, un projet hébergé aux États-Unis ajoute
  200 à 400 ms à chaque requête, et le tableau de bord en fait dix. Vérifiez
  dans **Project Settings → General → Region**. Frankfurt ou Londres divisent la
  latence par deux ou trois. La région ne se change pas après coup : il faut un
  nouveau projet et une restauration de sauvegarde. À arbitrer maintenant, tant
  que le volume de données est faible.
- **Le premier chargement charge tout.** Dix tables en parallèle. Acceptable à
  votre volume, à revoir passé quelques milliers de factures.

### « relation "lettres" does not exist »

`supabase/migration-002.sql` n'a pas été exécuté. L'application vous le dit
maintenant explicitement en haut de l'écran.
