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

> Si votre base tourne déjà, ne rejouez **que** `migration-002.sql`. Elle est
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
| `finance` | Factures, encaissements, dépenses, salaires, taux de change |
| `membre` | Clients, contrats, projets. Lit les montants, n'écrit pas. Ne voit pas les salaires |

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
