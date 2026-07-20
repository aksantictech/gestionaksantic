"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, Wallet, UserCog, ScrollText, Boxes,
  Settings, ShieldCheck, Plus, Search, X, Trash2, Pencil, Check, LogOut,
  ArrowDownRight, ArrowUpRight, AlertTriangle, Building2, Mail, PieChart, ExternalLink,
  Printer, History, Ban, Filter, ChevronRight, Target,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-client";
import {
  toCdf, fmt, dateFr, today, totalFacture, payeCdf, resteCdf, etatFacture, SOCIETE,
} from "@/lib/money";
import type { EtatCode } from "@/lib/money";
import type {
  Profile, Client, Facture, Paiement, Depense, Employe, Contrat, Projet,
  Responsable, Devise, Role, HistoriqueFacture,
} from "@/lib/types";
import type { Data, P } from "./shared";
import { Tag, Btn, Input, Select, Field, Modal, Empty, Money, inputCls, champCls } from "./ui";
import { FacturePapier } from "./facture-papier";
import { AksanticLogo, AksanticMark } from "./logo";
import { FondClair } from "./fond";
import { Fichier } from "./fichier";
import { Lettres } from "./lettres";
import { Synthese } from "./synthese";

const CATEGORIES = [
  "Loyer", "Internet & télécom", "Transport", "Matériel", "Licences & abonnements",
  "Honoraires", "Frais bancaires", "Salaires", "Fournitures", "Autre",
];
const COMPTES = ["Banque USD", "Banque CDF", "Caisse", "Mobile money"];

/* ======================================================================== APP */

export default function Gestion({ profil }: { profil: Profile }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  // Un membre n'a pas accès à Synthèse : sa page d'accueil est l'activité.
  const [vue, setVue] = useState(
    profil.role === "admin" || profil.role === "finance" ? "synthese" : "clients",
  );
  const [err, setErr] = useState("");

  const peutEcrire = profil.role === "admin" || profil.role === "finance";
  // Le même prédicat que can_see_money() côté base : un membre ne voit RIEN de
  // financier. C'est la RLS qui protège vraiment ; ceci ne fait que cacher ce
  // qu'il ne pourrait de toute façon pas charger.
  const peutVoirArgent = peutEcrire;

  const charger = useCallback(async () => {
    const [cl, fa, pa, de, em, co, pr, le, hi, bu, pf, tx] = await Promise.all([
      supabase.from("clients").select("*").order("denomination"),
      supabase.from("factures").select("*").order("date", { ascending: false }),
      supabase.from("paiements").select("*"),
      supabase.from("depenses").select("*").order("date", { ascending: false }),
      supabase.from("employes").select("*").order("matricule"),
      supabase.from("contrats").select("*").order("date_debut", { ascending: false }),
      supabase.from("projets").select("*").order("nom"),
      supabase.from("lettres").select("*").order("date_lettre", { ascending: false }),
      supabase.from("facture_historique").select("*").order("at", { ascending: false }).limit(500),
      supabase.from("budgets").select("*").order("annee", { ascending: false }),
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("parametres").select("valeur").eq("cle", "taux_usd_cdf").single(),
    ]);

    // Un écran vide sans explication, c'est le pire des deux mondes : on croit
    // qu'il n'y a pas de données alors que la requête a échoué. On le dit.
    const rate = [
      ["clients", cl], ["factures", fa], ["paiements", pa], ["dépenses", de],
      ["équipe", em], ["contrats", co], ["projets", pr], ["lettres", le],
    ].filter(([, r]) => (r as { error: unknown }).error);

    if (rate.length) {
      const manquant = rate.some(([, r]) =>
        String((r as { error: { message?: string } }).error?.message ?? "").includes("does not exist"));
      setErr(
        `Impossible de charger : ${rate.map(([n]) => n).join(", ")}.` +
        (manquant ? " Une table manque : exécutez supabase/migration-002.sql dans Supabase." : ""),
      );
    }

    setD({
      clients: cl.data ?? [], factures: fa.data ?? [], paiements: pa.data ?? [],
      depenses: de.data ?? [], employes: em.data ?? [], contrats: co.data ?? [],
      projets: pr.data ?? [], lettres: le.data ?? [], historique: hi.data ?? [],
      profiles: pf.data ?? [], budgets: bu.data ?? [], taux: Number(tx.data?.valeur ?? 2900),
    });
  }, [supabase]);

  useEffect(() => { charger(); }, [charger]);

  /** Toute écriture passe par ici : une erreur RLS doit se voir, pas se taire. */
  const ecrire = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op;
    if (error) { setErr(error.message); return false; }
    setErr("");
    await charger();
    return true;
  };

  if (!d) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5">
        <AksanticMark size={84} />
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-acier">
          Chargement du registre
        </p>
      </div>
    );
  }

  // Deux menus. Le membre ne voit que l'activité commerciale ; jamais l'argent,
  // jamais les paramètres. Ce filtrage est cosmétique — la vraie barrière est la
  // RLS — mais montrer un onglet qui renverrait des données vides serait pire.
  const menuFinancier = [
    { id: "synthese", label: "Synthèse", icon: PieChart },
    { id: "budget", label: "Budget", icon: Target },
    { id: "registre", label: "Registre", icon: LayoutDashboard },
    { id: "factures", label: "Factures", icon: FileText },
    { id: "depenses", label: "Dépenses", icon: Wallet },
  ];
  const menuCommun = [
    { id: "lettres", label: "Lettres", icon: Mail },
    { id: "clients", label: "Clients", icon: Users },
    { id: "contrats", label: "Contrats", icon: ScrollText },
    { id: "equipe", label: "Équipe", icon: UserCog },
    { id: "projets", label: "Projets", icon: Boxes },
  ];
  const nav = [
    ...(peutVoirArgent ? menuFinancier : []),
    ...menuCommun,
    ...(peutVoirArgent ? [{ id: "parametres", label: "Paramètres", icon: Settings }] : []),
    ...(profil.role === "admin" ? [{ id: "admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const props = { d, profil, peutEcrire, peutVoirArgent, ecrire, supabase, charger };

  return (
    <div className="min-h-screen">
      <FondClair />
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col bg-white/40 lg:flex-row">
        {/* La barre latérale porte la marque : navy, comme le logo. Le contenu
            reste clair — on y passe la journée, il doit rester lisible. */}
        <aside className="relative z-10 flex shrink-0 flex-col bg-navy-900 lg:min-h-screen lg:w-60">
          <div className="px-5 py-6">
            <AksanticLogo size={34} clair />
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
            {nav.map((n) => {
              const actif = vue === n.id;
              return (
                <button
                  key={n.id} onClick={() => setVue(n.id)}
                  aria-current={actif ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    actif ? "bg-white/10 font-semibold text-white" : "text-ciel-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {/* L'orchidée ne décore pas : elle désigne. */}
                  {actif && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-orchidee lg:-left-3" />
                  )}
                  <n.icon size={16} className={actif ? "text-orchidee" : ""} />
                  {n.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 px-5 py-4">
            <p className="truncate text-sm font-medium text-white">{profil.full_name}</p>
            <p className="truncate text-xs text-ciel-300">{profil.email}</p>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ciel-200">
                {profil.role}
              </span>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); }}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-ciel-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={13} /> Quitter
              </button>
            </div>
          </div>
        </aside>

        <main className="relative z-10 min-w-0 flex-1 px-5 py-7 lg:px-9 lg:py-9">
          {err && (
            <div className="mb-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>{err}</p>
                <p className="mt-1 text-xs text-red-600">
                  Si le message parle de « policy », c'est que votre rôle n'autorise pas cette action.
                </p>
              </div>
            </div>
          )}

          {peutVoirArgent && vue === "synthese" && <Synthese {...props} />}
          {peutVoirArgent && vue === "budget" && <BudgetVue {...props} />}
          {peutVoirArgent && vue === "registre" && <Registre {...props} aller={setVue} />}
          {peutVoirArgent && vue === "factures" && <Factures {...props} />}
          {vue === "clients" && <Clients {...props} />}
          {peutVoirArgent && vue === "depenses" && <Depenses {...props} />}
          {vue === "contrats" && <Contrats {...props} />}
          {vue === "lettres" && <Lettres {...props} />}
          {vue === "equipe" && <Equipe {...props} />}
          {vue === "projets" && <Projets {...props} />}
          {peutVoirArgent && vue === "parametres" && <Parametres {...props} />}
          {vue === "admin" && <Admin {...props} />}
        </main>
      </div>
    </div>
  );
}

const Titre = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h1 className="font-display text-2xl font-extrabold tracking-tight">{children}</h1>
    {action}
  </div>
);

/* =================================================================== REGISTRE */

function Registre({ d, aller }: P & { aller: (v: string) => void }) {
  const paiementsDe = (id: string) => d.paiements.filter((p) => p.facture_id === id);
  const nomClient = (id: string | null) => d.clients.find((c) => c.id === id)?.denomination ?? "Interne";

  const k = useMemo(() => {
    const emises = d.factures.filter((f) => f.statut === "emise");
    const encaisse = emises.reduce((s, f) => s + payeCdf(paiementsDe(f.id)), 0);
    const attente = emises.reduce((s, f) => s + Math.max(0, resteCdf(f, paiementsDe(f.id))), 0);
    const retard = emises
      .filter((f) => etatFacture(f, paiementsDe(f.id)).tone === "late")
      .reduce((s, f) => s + Math.max(0, resteCdf(f, paiementsDe(f.id))), 0);
    const sorties = d.depenses.reduce((s, x) => s + toCdf(x.montant, x.devise, x.taux), 0);
    return { encaisse, attente, retard, solde: encaisse - sorties };
  }, [d]);

  const evenements = useMemo(() => {
    const ev: { date: string; sens: "in" | "out" | "flat"; titre: string; sous: string; cdf: number | null; pose?: boolean }[] = [];
    d.factures.forEach((f) => {
      if (f.statut === "emise")
        ev.push({ date: f.date, sens: "in", titre: `Facture ${f.numero}`, sous: nomClient(f.client_id),
          cdf: toCdf(totalFacture(f), f.devise, f.taux), pose: true });
      paiementsDe(f.id).forEach((p) =>
        ev.push({ date: p.date, sens: "in", titre: `Encaissement · ${f.numero}`, sous: nomClient(f.client_id),
          cdf: toCdf(p.montant, p.devise, p.taux) }));
    });
    d.depenses.forEach((x) =>
      ev.push({ date: x.date, sens: "out", titre: x.description || x.categorie, sous: `${x.categorie} · ${x.compte}`,
        cdf: toCdf(x.montant, x.devise, x.taux) }));
    d.contrats.forEach((c) =>
      ev.push({ date: c.date_debut, sens: "flat", titre: `Contrat ${c.reference}`, sous: nomClient(c.client_id), cdf: null }));
    return ev.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  }, [d]);

  const alertes = useMemo(() => {
    const a: { t: string; s: string; cdf: number | null }[] = [];
    d.factures.filter((f) => etatFacture(f, paiementsDe(f.id)).tone === "late").forEach((f) =>
      a.push({ t: `Facture ${f.numero} échue`, s: nomClient(f.client_id), cdf: resteCdf(f, paiementsDe(f.id)) }));
    const dans45 = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    d.contrats.filter((c) => c.statut === "actif" && c.date_fin && c.date_fin <= dans45).forEach((c) =>
      a.push({ t: `Contrat ${c.reference} arrive à terme`, s: dateFr(c.date_fin), cdf: null }));
    return a;
  }, [d]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Registre</h1>
        <p className="mt-1 text-sm text-acier">
          {SOCIETE.denomination} · Converti en francs congolais au taux de la date d'opération.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-ciel-100 shadow-carte ring-1 ring-ciel-100 lg:grid-cols-4">
        {[
          { l: "Encaissé", v: k.encaisse, c: "text-emerald-600" },
          { l: "En attente", v: k.attente, c: "text-amber-600" },
          { l: "Dont en retard", v: k.retard, c: k.retard > 0 ? "text-red-600" : "text-acier" },
          { l: "Solde", v: k.solde, c: k.solde >= 0 ? "text-navy-900" : "text-red-600" },
        ].map((x) => (
          <div key={x.l} className="bg-white px-4 py-5">
            <p className="text-xs uppercase tracking-wide text-acier">{x.l}</p>
            <p className="mt-2"><Money cdf={x.v} size="xl" tone={x.c} /></p>
          </div>
        ))}
      </section>

      {alertes.length > 0 && (
        <section className="overflow-hidden rounded-lg bg-white ring-1 ring-amber-200">
          <h2 className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <AlertTriangle size={15} /> À traiter ({alertes.length})
          </h2>
          <ul className="divide-y divide-ciel-100">
            {alertes.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{a.t}</p>
                  <p className="truncate text-xs text-acier">{a.s}</p>
                </div>
                {a.cdf !== null && <Money cdf={a.cdf} size="sm" tone="text-red-600" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-acier">Mouvements</h2>
        {evenements.length === 0 ? (
          <Empty icon={LayoutDashboard} titre="Rien encore. Créez un client, puis une facture."
            action={<Btn variant="primary" onClick={() => aller("clients")}><Plus size={15} /> Ajouter un client</Btn>} />
        ) : (
          <ol className="overflow-hidden rounded-xl bg-white shadow-carte ring-1 ring-ciel-100">
            {evenements.map((e, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-ciel-100 px-4 py-3 last:border-0">
                <span className="w-24 shrink-0 font-mono text-xs text-acier">{dateFr(e.date)}</span>
                <span className="shrink-0">
                  {e.sens === "in" && <ArrowDownRight size={14} className={e.pose ? "text-ciel-300" : "text-emerald-600"} />}
                  {e.sens === "out" && <ArrowUpRight size={14} className="text-red-500" />}
                  {e.sens === "flat" && <ScrollText size={14} className="text-ciel-300" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{e.titre}</p>
                  <p className="truncate text-xs text-acier">{e.sous}</p>
                </div>
                {e.cdf !== null && (
                  <Money cdf={e.cdf} size="sm"
                    tone={e.sens === "out" ? "text-red-600" : e.pose ? "text-acier" : "text-emerald-600"} />
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/* =================================================================== FACTURES */

function Factures({ d, peutEcrire, ecrire, supabase, charger }: P) {
  const [edit, setEdit] = useState<Facture | null>(null);
  const [payer, setPayer] = useState<Facture | null>(null);
  const [imprimer, setImprimer] = useState<Facture | null>(null);
  const [histo, setHisto] = useState<Facture | null>(null);
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<"tous" | EtatCode>("tous");

  const paiementsDe = (id: string) => d.paiements.filter((p) => p.facture_id === id);
  const nomClient = (id: string) => d.clients.find((c) => c.id === id)?.denomination ?? "—";

  const numero = () => {
    const an = new Date().getFullYear();
    const n = d.factures.filter((f) => f.numero.includes(`/${an}/`)).length + 1;
    return `FAC/${an}/${String(n).padStart(4, "0")}`;
  };

  const vide = (): Facture => ({
    id: "", numero: numero(), client_id: d.clients[0]?.id ?? "", objet: "",
    date: today(), echeance: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    devise: "USD", taux: d.taux, lignes: [{ designation: "", qte: 1, pu: 0 }],
    statut: "brouillon", annulee_motif: null,
  });

  const enregistrer = async (f: Facture) => {
    const { id, ...champs } = f;
    const ok = id
      ? await ecrire(supabase.from("factures").update(champs).eq("id", id))
      : await ecrire(supabase.from("factures").insert(champs));
    if (ok) setEdit(null);
  };

  const annuler = async (f: Facture) => {
    const motif = prompt(`Annuler la facture ${f.numero} ?\n\nMotif (il restera dans l'historique) :`);
    if (!motif?.trim()) return;
    await ecrire(supabase.from("factures").update({ statut: "annulee", annulee_motif: motif }).eq("id", f.id));
  };

  // Les quatre états demandés. Deux viennent de la base, deux du calcul —
  // l'utilisateur, lui, n'a pas à connaître la différence.
  const ETATS: { v: "tous" | EtatCode; l: string }[] = [
    { v: "tous", l: "Toutes" },
    { v: "brouillon", l: "Brouillons" },
    { v: "emise", l: "Émises" },
    { v: "en_souffrance", l: "En souffrance" },
    { v: "paye", l: "Payées" },
    { v: "annulee", l: "Annulées" },
  ];

  const compte = (v: "tous" | EtatCode) =>
    v === "tous" ? d.factures.length
      : d.factures.filter((f) => etatFacture(f, paiementsDe(f.id)).code === v).length;

  const liste = d.factures.filter((f) => {
    const e = etatFacture(f, paiementsDe(f.id));
    if (filtre !== "tous" && e.code !== filtre) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return f.numero.toLowerCase().includes(t)
      || nomClient(f.client_id).toLowerCase().includes(t)
      || (f.objet ?? "").toLowerCase().includes(t)
      || f.lignes.some((l) => l.designation.toLowerCase().includes(t));
  });

  return (
    <div className="space-y-5">
      <Titre action={
        <div className="flex gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-ciel-300" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Numéro, client, libellé…" className={`${inputCls} pl-9`} />
          </div>
          {peutEcrire && d.clients.length > 0 && (
            <Btn variant="primary" onClick={() => setEdit(vide())}><Plus size={15} /> Nouvelle facture</Btn>
          )}
        </div>
      }>Factures</Titre>

      {/* Filtres par état. Chaque onglet porte son compte : on sait ce qu'on
          va trouver avant de cliquer. */}
      <div className="flex flex-wrap gap-1.5">
        {ETATS.map((e) => {
          const n = compte(e.v);
          const actif = filtre === e.v;
          return (
            <button
              key={e.v} onClick={() => setFiltre(e.v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                actif ? "bg-navy-900 text-white" : "bg-white text-acier ring-1 ring-ciel-100 hover:bg-ciel-50"
              } ${n === 0 && !actif ? "opacity-40" : ""}`}
            >
              {e.l}
              <span className={actif ? "text-ciel-300" : "text-ciel-300"}>{n}</span>
            </button>
          );
        })}
      </div>

      {d.clients.length === 0 ? (
        <Empty icon={Users} titre="Ajoutez d'abord un client : une facture a besoin d'un destinataire." />
      ) : liste.length === 0 ? (
        <Empty icon={FileText} titre={q || filtre !== "tous" ? "Aucune facture ne correspond." : "Aucune facture."} />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-carte ring-1 ring-ciel-100">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-ciel-100 text-left text-xs uppercase tracking-wide text-acier">
              <tr>
                {["Numéro", "Client", "Objet", "Échéance"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-right font-medium">Reste</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ciel-100">
              {liste.map((f) => {
                const pmts = paiementsDe(f.id);
                const e = etatFacture(f, pmts);
                return (
                  <tr key={f.id} className={`hover:bg-ciel-50 ${f.statut === "annulee" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs">{f.numero}</td>
                    <td className="px-4 py-3">{nomClient(f.client_id)}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-acier">{f.objet}</td>
                    <td className="px-4 py-3 font-mono text-xs text-acier">{dateFr(f.echeance)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {fmt(totalFacture(f), f.devise)} <span className="text-xs text-acier">{f.devise}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money cdf={Math.max(0, resteCdf(f, pmts))} size="sm"
                        tone={e.code === "en_souffrance" ? "text-red-600" : ""} />
                    </td>
                    <td className="px-4 py-3"><Tag tone={e.tone}>{e.label}</Tag></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => setImprimer(f)} title="Imprimer ou enregistrer en PDF"
                          className="rounded p-1.5 text-acier hover:bg-ciel-100"><Printer size={15} /></button>
                        <button onClick={() => setHisto(f)} title="Historique"
                          className="rounded p-1.5 text-acier hover:bg-ciel-100"><History size={15} /></button>
                        {peutEcrire && f.statut !== "annulee" && (
                          <>
                            {e.code !== "paye" && f.statut === "emise" && (
                              <button onClick={() => setPayer(f)} title="Enregistrer un encaissement"
                                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                            )}
                            <button onClick={() => setEdit(f)} title="Modifier"
                              className="rounded p-1.5 text-acier hover:bg-ciel-100"><Pencil size={15} /></button>
                            <button onClick={() => annuler(f)} title="Annuler"
                              className="rounded p-1.5 text-amber-600 hover:bg-amber-50"><Ban size={15} /></button>
                          </>
                        )}
                        {peutEcrire && f.statut === "brouillon" && (
                          <button
                            onClick={() => confirm(`Supprimer définitivement ${f.numero} ?`)
                              && ecrire(supabase.from("factures").delete().eq("id", f.id))}
                            title="Supprimer (brouillon uniquement)"
                            className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ciel-300">
        Une facture émise ne se supprime plus : elle s'annule, avec un motif, et la trace reste.
      </p>

      {edit && <FormFacture f={edit} clients={d.clients} onSave={enregistrer} onClose={() => setEdit(null)} />}

      {payer && (
        <FormPaiement
          f={payer} taux={d.taux} reste={Math.max(0, resteCdf(payer, paiementsDe(payer.id)))}
          onClose={() => setPayer(null)}
          onSave={async (p) => {
            if (await ecrire(supabase.from("paiements").insert({ ...p, facture_id: payer.id }))) setPayer(null);
          }}
        />
      )}

      {imprimer && (
        <VueImpression
          f={imprimer} client={d.clients.find((c) => c.id === imprimer.client_id)}
          paiements={paiementsDe(imprimer.id)} onClose={() => setImprimer(null)}
        />
      )}

      {histo && (
        <VueHistorique
          f={histo} lignes={d.historique.filter((h) => h.facture_id === histo.id)}
          onClose={() => setHisto(null)} charger={charger}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- impression */

function VueImpression({
  f, client, paiements, onClose,
}: { f: Facture; client: Client | undefined; paiements: Paiement[]; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="a-imprimer fixed inset-0 z-50 overflow-y-auto bg-navy-950/50 p-4 backdrop-blur-sm sm:p-8">
      <div className="rien-a-imprimer mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">Facture {f.numero}</p>
        <div className="flex gap-2">
          <Btn onClick={onClose}>Fermer</Btn>
          <Btn variant="primary" onClick={() => window.print()}>
            <Printer size={15} /> Imprimer / Enregistrer en PDF
          </Btn>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] rounded-xl bg-white shadow-2xl">
        <FacturePapier f={f} client={client} paiements={paiements} />
      </div>

      <p className="rien-a-imprimer mx-auto mt-4 max-w-[210mm] text-center text-xs text-ciel-300">
        Dans la boîte d'impression, choisissez « Enregistrer au format PDF » comme destination.
        Décochez « En-têtes et pieds de page » pour un rendu propre.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- historique */

const LIBELLE_ACTION: Record<string, { l: string; c: string }> = {
  creation: { l: "Créée", c: "text-acier" },
  modification: { l: "Modifiée", c: "text-amber-600" },
  emission: { l: "Émise", c: "text-navy-900" },
  annulation: { l: "Annulée", c: "text-red-600" },
  encaissement: { l: "Encaissement", c: "text-emerald-600" },
  suppression_encaissement: { l: "Encaissement supprimé", c: "text-red-600" },
};

function VueHistorique({
  f, lignes, onClose, charger,
}: { f: Facture; lignes: HistoriqueFacture[]; onClose: () => void; charger: () => Promise<void> }) {
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title={`Historique · ${f.numero}`} onClose={onClose}>
      {lignes.length === 0 ? (
        <p className="py-8 text-center text-sm text-acier">
          Aucune trace. Si cette facture est antérieure à la migration 003, c'est normal :
          l'historique ne remonte pas le temps.
        </p>
      ) : (
        <ol className="space-y-3">
          {lignes.map((h) => {
            const a = LIBELLE_ACTION[h.action] ?? { l: h.action, c: "text-acier" };
            const champs = (h.detail as { champs?: Record<string, [unknown, unknown]> }).champs;
            return (
              <li key={h.id} className="flex gap-3 border-b border-ciel-100 pb-3 last:border-0">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orchidee" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${a.c}`}>{a.l}</p>
                  <p className="text-xs text-acier">
                    {h.acteur_nom ?? "—"} ·{" "}
                    {new Date(h.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                  </p>

                  {champs && (
                    <ul className="mt-1.5 space-y-0.5">
                      {Object.entries(champs).map(([champ, [avant, apres]]) => (
                        <li key={champ} className="font-mono text-xs text-acier">
                          {champ} : <span className="text-red-500 line-through">{String(avant ?? "—")}</span>
                          {" → "}
                          <span className="text-emerald-600">{String(apres ?? "—")}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {h.action === "encaissement" && (
                    <p className="mt-1 font-mono text-xs text-emerald-600">
                      {String(h.detail.montant)} {String(h.detail.devise)} · {String(h.detail.compte)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-5 rounded-lg bg-ciel-50 px-3 py-2.5 text-xs leading-relaxed text-acier">
        Cet historique est écrit par la base, jamais par l'application. Personne ne peut modifier
        une facture sans laisser de trace — pas même un administrateur depuis l'interface.
      </p>
    </Modal>
  );
}


function FormFacture({
  f, clients, onSave, onClose,
}: { f: Facture; clients: Client[]; onSave: (f: Facture) => void; onClose: () => void }) {
  const [v, setV] = useState(f);
  const [busy, setBusy] = useState(false);
  const maj = (k: keyof Facture) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value } as Facture);
  const majLigne = (i: number, k: string, val: string) => {
    const l = [...v.lignes];
    l[i] = { ...l[i], [k]: k === "designation" ? val : Number(val) };
    setV({ ...v, lignes: l });
  };
  const envoyer = (statut: "brouillon" | "emise") => {
    setBusy(true);
    onSave({ ...v, statut, taux: v.devise === "CDF" ? 1 : Number(v.taux) });
    setBusy(false);
  };

  return (
    <Modal title={f.id ? `Facture ${f.numero}` : "Nouvelle facture"} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client">
            <Select value={v.client_id} onChange={maj("client_id")}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.denomination}</option>)}
            </Select>
          </Field>
          <Field label="Numéro"><Input value={v.numero} onChange={maj("numero")} /></Field>
          <Field label="Date"><Input type="date" value={v.date} onChange={maj("date")} /></Field>
          <Field label="Échéance"><Input type="date" value={v.echeance} onChange={maj("echeance")} /></Field>
          <Field label="Devise">
            <Select value={v.devise} onChange={(e) =>
              setV({ ...v, devise: e.target.value as Devise, taux: e.target.value === "CDF" ? 1 : v.taux })}>
              <option value="USD">USD</option><option value="CDF">CDF</option>
            </Select>
          </Field>
          <Field label="Taux du jour" hint="Figé sur la facture. Les variations ultérieures ne la touchent pas.">
            <Input type="number" value={v.taux} onChange={maj("taux")} disabled={v.devise === "CDF"} />
          </Field>
        </div>

        <Field label="Objet"><Input value={v.objet ?? ""} onChange={maj("objet")} placeholder="Dashboard Power BI — phase 1" /></Field>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-acier">Lignes</span>
            <span className="text-xs text-ciel-300">Libellé · quantité · prix unitaire</span>
          </div>
          <div className="space-y-2">
            {v.lignes.map((l, i) => (
              <div key={i} className="flex gap-2">
                {/* champCls, pas inputCls : ce dernier impose w-full et écrasait
                    les largeurs — le libellé se retrouvait réduit à rien. */}
                <input value={l.designation} onChange={(e) => majLigne(i, "designation", e.target.value)}
                  placeholder="Libellé de la prestation" className={`${champCls} min-w-0 flex-1`} />
                <input type="number" value={l.qte} onChange={(e) => majLigne(i, "qte", e.target.value)}
                  title="Quantité" className={`${champCls} w-20 shrink-0 text-right font-mono`} />
                <input type="number" value={l.pu} onChange={(e) => majLigne(i, "pu", e.target.value)}
                  placeholder="P.U." title="Prix unitaire" className={`${champCls} w-32 shrink-0 text-right font-mono`} />
                {v.lignes.length > 1 && (
                  <button onClick={() => setV({ ...v, lignes: v.lignes.filter((_, j) => j !== i) })}
                    className="rounded px-2 text-red-500 hover:bg-red-50"><X size={15} /></button>
                )}
              </div>
            ))}
          </div>
          <Btn className="mt-2" onClick={() => setV({ ...v, lignes: [...v.lignes, { designation: "", qte: 1, pu: 0 }] })}>
            <Plus size={14} /> Ajouter une ligne
          </Btn>
        </div>

        <div className="flex items-baseline justify-between border-t border-ciel-100 pt-4">
          <span className="text-sm text-acier">Total</span>
          <div className="text-right">
            <p className="font-mono text-xl tabular-nums">
              {fmt(totalFacture(v), v.devise)} <span className="text-sm text-acier">{v.devise}</span>
            </p>
            {v.devise === "USD" && (
              <p className="font-mono text-xs text-acier">≈ {fmt(toCdf(totalFacture(v), v.devise, v.taux))} FC</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-ciel-100 pt-4">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn onClick={() => envoyer("brouillon")} disabled={busy}>Garder en brouillon</Btn>
          <Btn variant="primary" onClick={() => envoyer("emise")} disabled={busy}>Émettre</Btn>
        </div>
      </div>
    </Modal>
  );
}

function FormPaiement({
  f, taux, reste, onSave, onClose,
}: {
  f: Facture; taux: number; reste: number;
  onSave: (p: Omit<Paiement, "id" | "facture_id">) => void; onClose: () => void;
}) {
  const [p, setP] = useState({
    date: today(), devise: f.devise as Devise, taux: f.devise === "CDF" ? 1 : taux,
    montant: f.devise === "CDF" ? reste : Math.round((reste / taux) * 100) / 100,
    compte: "Banque USD",
  });
  return (
    <Modal title={`Encaissement · ${f.numero}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded border border-ciel-100 bg-ciel-50 px-3 py-2 text-sm text-acier">
          Reste dû : <Money cdf={reste} size="sm" tone="text-navy-900" />
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><Input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field>
          <Field label="Compte">
            <Select value={p.compte} onChange={(e) => setP({ ...p, compte: e.target.value })}>
              {COMPTES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Montant"><Input type="number" value={p.montant} onChange={(e) => setP({ ...p, montant: Number(e.target.value) })} /></Field>
          <Field label="Devise">
            <Select value={p.devise} onChange={(e) =>
              setP({ ...p, devise: e.target.value as Devise, taux: e.target.value === "CDF" ? 1 : taux })}>
              <option value="USD">USD</option><option value="CDF">CDF</option>
            </Select>
          </Field>
          <Field label="Taux de l'encaissement" hint="Il peut différer de celui de la facture. C'est normal, et c'est conservé.">
            <Input type="number" value={p.taux} onChange={(e) => setP({ ...p, taux: Number(e.target.value) })} disabled={p.devise === "CDF"} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-ciel-100 pt-4">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={() => onSave(p)}>Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ==================================================================== CLIENTS */

function Clients({ d, ecrire, supabase, ...reste }: P) {
  const [edit, setEdit] = useState<Partial<Client> | null>(null);
  const [fiche, setFiche] = useState<Client | null>(null);
  const vide = { denomination: "", contact: "", email: "", phone: "", adresse: "", rccm: "", nif: "" };

  const facturesDe = (id: string) => d.factures.filter((f) => f.client_id === id);
  const contratsDe = (id: string) => d.contrats.filter((c) => c.client_id === id);
  const pmts = (id: string) => d.paiements.filter((p) => p.facture_id === id);

  const chiffres = (id: string) => {
    const emises = facturesDe(id).filter((f) => f.statut === "emise");
    const facture = emises.reduce((s, f) => s + toCdf(totalFacture(f), f.devise, f.taux), 0);
    const du = emises.reduce((s, f) => s + Math.max(0, resteCdf(f, pmts(f.id))), 0);
    const retard = emises.filter((f) => etatFacture(f, pmts(f.id)).code === "en_souffrance").length;
    return { facture, du, retard, nb: facturesDe(id).length, contrats: contratsDe(id).filter((c) => c.statut === "actif").length };
  };

  const save = async (x: Partial<Client>) => {
    const { id, ...champs } = x;
    const ok = id
      ? await ecrire(supabase.from("clients").update(champs).eq("id", id))
      : await ecrire(supabase.from("clients").insert(champs));
    if (ok) setEdit(null);
  };

  return (
    <div className="space-y-5">
      <Titre action={<Btn variant="primary" onClick={() => setEdit(vide)}><Plus size={15} /> Ajouter un client</Btn>}>
        Clients
      </Titre>

      {d.clients.length === 0 ? (
        <Empty icon={Users} titre="Aucun client."
          action={<Btn variant="primary" onClick={() => setEdit(vide)}><Plus size={15} /> Ajouter un client</Btn>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.clients.map((c) => {
            const k = chiffres(c.id);
            return (
              <div key={c.id} className="flex flex-col rounded-xl bg-white p-4 shadow-carte ring-1 ring-ciel-100 transition-shadow hover:shadow-leve">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.denomination}</p>
                    <p className="truncate text-xs text-acier">{c.contact || c.email || "—"}</p>
                  </div>
                  <div className="flex shrink-0">
                    <button onClick={() => setEdit(c)} className="rounded p-1.5 text-acier hover:bg-ciel-100"><Pencil size={14} /></button>
                    <button onClick={() => confirm(`Supprimer ${c.denomination} ?`) && ecrire(supabase.from("clients").delete().eq("id", c.id))}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mt-3 border-t border-ciel-100 pt-3">
                  <p className="text-xs text-acier">Facturé</p>
                  <Money cdf={k.facture} size="sm" />
                  {k.du > 0 && (
                    <p className="mt-1 text-xs">
                      <span className="text-acier">Dû : </span>
                      <span className={k.retard ? "font-medium text-red-600" : "text-amber-600"}>{fmt(k.du)} FC</span>
                      {k.retard > 0 && <span className="text-red-600"> · {k.retard} en souffrance</span>}
                    </p>
                  )}
                </div>

                {/* Le client n'est pas une fiche d'adresse : c'est un dossier.
                    Un clic doit donner ses factures et ses contrats. */}
                <button
                  onClick={() => setFiche(c)}
                  className="mt-3 flex items-center justify-between rounded-lg bg-ciel-50 px-3 py-2 text-xs font-medium text-navy-900 transition-colors hover:bg-ciel-100"
                >
                  <span>{k.nb} facture{k.nb > 1 ? "s" : ""} · {k.contrats} contrat{k.contrats > 1 ? "s" : ""} actif{k.contrats > 1 ? "s" : ""}</span>
                  <ChevronRight size={14} className="text-orchidee" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {edit && (
        <FormSimple titre={edit.id ? "Modifier le client" : "Nouveau client"} v={edit} onClose={() => setEdit(null)} onSave={save}
          champs={[
            { k: "denomination", l: "Dénomination", req: true },
            { k: "contact", l: "Personne de contact" },
            { k: "email", l: "Email", type: "email" },
            { k: "phone", l: "Téléphone" },
            { k: "adresse", l: "Adresse" },
            { k: "rccm", l: "RCCM" },
            { k: "nif", l: "NIF", hint: "Utile : il apparaîtra sur les factures." },
          ]} />
      )}

      {fiche && (
        <FicheClient
          c={fiche} d={d} onClose={() => setFiche(null)}
          factures={facturesDe(fiche.id)} contrats={contratsDe(fiche.id)}
        />
      )}
    </div>
  );
}

/** Le dossier d'un client : ce qu'on lui a facturé, ce qu'il doit, ce qui le lie. */
function FicheClient({
  c, d, factures, contrats, onClose,
}: { c: Client; d: Data; factures: Facture[]; contrats: Contrat[]; onClose: () => void }) {
  const pmts = (id: string) => d.paiements.filter((p) => p.facture_id === id);

  const total = factures.filter((f) => f.statut === "emise")
    .reduce((s, f) => s + toCdf(totalFacture(f), f.devise, f.taux), 0);
  const du = factures.filter((f) => f.statut === "emise")
    .reduce((s, f) => s + Math.max(0, resteCdf(f, pmts(f.id))), 0);

  return (
    <Modal title={c.denomination} onClose={onClose} wide>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-ciel-100 ring-1 ring-ciel-100">
          {[
            { l: "Facturé", v: total, t: "" },
            { l: "Reste dû", v: du, t: du > 0 ? "text-amber-600" : "text-emerald-600" },
            { l: "Encaissé", v: total - du, t: "text-emerald-600" },
          ].map((x) => (
            <div key={x.l} className="bg-white px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-acier">{x.l}</p>
              <p className="mt-1"><Money cdf={x.v} size="sm" tone={x.t} /></p>
            </div>
          ))}
        </div>

        {(c.rccm || c.nif || c.adresse || c.email || c.phone) && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-ciel-50 px-4 py-3 text-xs">
            {[["Contact", c.contact], ["Adresse", c.adresse], ["Email", c.email],
              ["Téléphone", c.phone], ["RCCM", c.rccm], ["N° Impôt", c.nif]]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-20 shrink-0 text-acier">{k}</dt>
                  <dd className="min-w-0 truncate font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-acier">
            Factures ({factures.length})
          </h3>
          {factures.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ciel-200 py-6 text-center text-xs text-acier">
              Aucune facture pour ce client.
            </p>
          ) : (
            <ul className="divide-y divide-ciel-100 rounded-lg ring-1 ring-ciel-100">
              {factures.map((f) => {
                const e = etatFacture(f, pmts(f.id));
                return (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-28 shrink-0 font-mono text-xs">{f.numero}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-acier">{f.objet || "—"}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">
                      {fmt(totalFacture(f), f.devise)} {f.devise}
                    </span>
                    <Tag tone={e.tone}>{e.label}</Tag>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-acier">
            Contrats ({contrats.length})
          </h3>
          {contrats.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ciel-200 py-6 text-center text-xs text-acier">
              Aucun contrat pour ce client.
            </p>
          ) : (
            <ul className="divide-y divide-ciel-100 rounded-lg ring-1 ring-ciel-100">
              {contrats.map((ct) => (
                <li key={ct.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-28 shrink-0 font-mono text-xs">{ct.reference}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-acier">{ct.objet || "—"}</span>
                  <span className="shrink-0 text-xs text-acier">
                    {ct.date_fin ? `→ ${dateFr(ct.date_fin)}` : "indéterminé"}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums">
                    {fmt(ct.montant, ct.devise)} {ct.devise}
                  </span>
                  <Tag tone={ct.statut === "actif" ? "ok" : "muted"}>{ct.statut}</Tag>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}


/* =================================================================== DÉPENSES */

function Depenses({ d, peutEcrire, ecrire, supabase }: P) {
  const [edit, setEdit] = useState<Partial<Depense> | null>(null);
  const vide = () => ({ date: today(), categorie: "Autre", description: "", montant: 0, devise: "USD" as Devise, taux: d.taux, compte: "Caisse" });

  const total = d.depenses.reduce((s, x) => s + toCdf(x.montant, x.devise, x.taux), 0);
  const parCat = useMemo(() => {
    const m: Record<string, number> = {};
    d.depenses.forEach((x) => { m[x.categorie] = (m[x.categorie] || 0) + toCdf(x.montant, x.devise, x.taux); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [d.depenses]);

  const save = async (x: Partial<Depense>) => {
    const { id, ...c } = x;
    const champs = { ...c, taux: c.devise === "CDF" ? 1 : Number(c.taux), montant: Number(c.montant) };
    const ok = id
      ? await ecrire(supabase.from("depenses").update(champs).eq("id", id))
      : await ecrire(supabase.from("depenses").insert(champs));
    if (ok) setEdit(null);
  };

  return (
    <div className="space-y-6">
      <Titre action={peutEcrire && <Btn variant="primary" onClick={() => setEdit(vide())}><Plus size={15} /> Ajouter une dépense</Btn>}>
        Dépenses
      </Titre>
      <p className="-mt-4 text-sm text-acier">Total : <Money cdf={total} size="sm" tone="text-red-600" /></p>

      {parCat.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {parCat.map(([c, m]) => (
            <span key={c} className="rounded bg-white px-3 py-1.5 text-xs ring-1 ring-ciel-100">
              {c} · <span className="font-mono text-acier">{fmt(m)} FC</span>
            </span>
          ))}
        </div>
      )}

      {d.depenses.length === 0 ? (
        <Empty icon={Wallet} titre="Aucune dépense enregistrée." />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-carte ring-1 ring-ciel-100">
          {d.depenses.map((x) => (
            <div key={x.id} className="flex items-center gap-3 border-b border-ciel-100 px-4 py-3 last:border-0">
              <span className="w-24 shrink-0 font-mono text-xs text-acier">{dateFr(x.date)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{x.description || x.categorie}</p>
                <p className="text-xs text-acier">{x.categorie} · {x.compte}</p>
              </div>
              <span className="font-mono text-sm tabular-nums text-red-600">
                {fmt(x.montant, x.devise)} <span className="text-xs text-acier">{x.devise}</span>
              </span>
              {peutEcrire && (
                <div className="flex shrink-0">
                  <button onClick={() => setEdit(x)} className="rounded p-1.5 text-acier hover:bg-ciel-100"><Pencil size={14} /></button>
                  <button onClick={() => ecrire(supabase.from("depenses").delete().eq("id", x.id))}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {edit && (
        <FormSimple titre={edit.id ? "Modifier la dépense" : "Nouvelle dépense"} v={edit} onClose={() => setEdit(null)} onSave={save}
          champs={[
            { k: "date", l: "Date", type: "date" },
            { k: "categorie", l: "Catégorie", type: "select", options: CATEGORIES.map((c) => ({ v: c, t: c })) },
            { k: "description", l: "Description" },
            { k: "montant", l: "Montant", type: "number" },
            { k: "devise", l: "Devise", type: "select", options: [{ v: "USD", t: "USD" }, { v: "CDF", t: "CDF" }] },
            { k: "taux", l: "Taux", type: "number" },
            { k: "compte", l: "Payé depuis", type: "select", options: COMPTES.map((c) => ({ v: c, t: c })) },
          ]} />
      )}
    </div>
  );
}

/* =================================================================== CONTRATS */

function Contrats({ d, ecrire, supabase }: P) {
  const [edit, setEdit] = useState<Partial<Contrat> | null>(null);
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("tous");
  const [client, setClient] = useState("tous");
  const [echeance, setEcheance] = useState("toutes");

  const nomClient = (id: string) => d.clients.find((c) => c.id === id)?.denomination ?? "—";
  const dans45 = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);

  const vide = () => ({
    reference: `CTR/${new Date().getFullYear()}/${String(d.contrats.length + 1).padStart(3, "0")}`,
    client_id: d.clients[0]?.id ?? "", objet: "", date_debut: today(), date_fin: "",
    montant: 0, devise: "USD" as Devise, statut: "actif" as const,
  });

  const save = async (x: Partial<Contrat>) => {
    const { id, ...c } = x;
    const champs = { ...c, date_fin: c.date_fin || null, montant: Number(c.montant) };
    const ok = id
      ? await ecrire(supabase.from("contrats").update(champs).eq("id", id))
      : await ecrire(supabase.from("contrats").insert(champs));
    if (ok) setEdit(null);
  };

  const liste = d.contrats.filter((c) => {
    if (statut !== "tous" && c.statut !== statut) return false;
    if (client !== "tous" && c.client_id !== client) return false;
    if (echeance === "proche" && !(c.date_fin && c.date_fin <= dans45 && c.date_fin >= today())) return false;
    if (echeance === "depassee" && !(c.date_fin && c.date_fin < today())) return false;
    if (echeance === "indeterminee" && c.date_fin) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!c.reference.toLowerCase().includes(t)
        && !(c.objet ?? "").toLowerCase().includes(t)
        && !nomClient(c.client_id).toLowerCase().includes(t)) return false;
    }
    return true;
  });

  const valeur = liste.reduce((s, c) => s + toCdf(c.montant, c.devise, d.taux), 0);
  const filtreActif = statut !== "tous" || client !== "tous" || echeance !== "toutes" || !!q;

  return (
    <div className="space-y-5">
      <Titre action={d.clients.length > 0 && (
        <Btn variant="primary" onClick={() => setEdit(vide())}><Plus size={15} /> Ajouter un contrat</Btn>
      )}>Contrats</Titre>

      {/* Les filtres sont dépliés, pas cachés derrière un bouton : on ne cherche
          pas un contrat une fois par an, on le cherche quand un client appelle. */}
      <div className="rounded-xl bg-white p-3 shadow-carte ring-1 ring-ciel-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 pr-1 text-xs font-semibold uppercase tracking-wider text-acier">
            <Filter size={13} /> Filtrer
          </span>

          <div className="relative min-w-[180px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-3 text-ciel-300" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Référence, objet, client…" className={`${inputCls} pl-8 py-2 text-xs`} />
          </div>

          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${champCls} w-36 py-2 text-xs`}>
            <option value="tous">Tous les statuts</option>
            {["actif", "suspendu", "termine", "resilie"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={client} onChange={(e) => setClient(e.target.value)} className={`${champCls} w-44 py-2 text-xs`}>
            <option value="tous">Tous les clients</option>
            {d.clients.map((c) => <option key={c.id} value={c.id}>{c.denomination}</option>)}
          </select>

          <select value={echeance} onChange={(e) => setEcheance(e.target.value)} className={`${champCls} w-44 py-2 text-xs`}>
            <option value="toutes">Toutes les échéances</option>
            <option value="proche">Échéance sous 45 jours</option>
            <option value="depassee">Échéance dépassée</option>
            <option value="indeterminee">Durée indéterminée</option>
          </select>

          {filtreActif && (
            <button
              onClick={() => { setQ(""); setStatut("tous"); setClient("tous"); setEcheance("toutes"); }}
              className="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-orchidee-600 hover:bg-ciel-50"
            >
              <X size={13} /> Réinitialiser
            </button>
          )}
        </div>

        {filtreActif && (
          <p className="mt-2.5 border-t border-ciel-100 pt-2.5 text-xs text-acier">
            {liste.length} contrat{liste.length > 1 ? "s" : ""} sur {d.contrats.length} ·
            valeur cumulée <Money cdf={valeur} size="sm" tone="text-navy-900" />
          </p>
        )}
      </div>

      {d.clients.length === 0 ? (
        <Empty icon={Users} titre="Ajoutez d'abord un client." />
      ) : liste.length === 0 ? (
        <Empty icon={ScrollText} titre={filtreActif ? "Aucun contrat ne correspond à ces filtres." : "Aucun contrat."} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {liste.map((c) => {
            const finit = c.date_fin && c.date_fin <= dans45;
            return (
              <div key={c.id} className="rounded-xl bg-white p-4 shadow-carte ring-1 ring-ciel-100 transition-shadow hover:shadow-leve">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-acier">{c.reference}</p>
                    <p className="mt-1 truncate font-medium">{c.objet || "Sans objet"}</p>
                    <p className="truncate text-xs text-acier">{nomClient(c.client_id)}</p>
                  </div>
                  <div className="flex shrink-0">
                    <button onClick={() => setEdit(c)} className="rounded p-1.5 text-acier hover:bg-ciel-100"><Pencil size={14} /></button>
                    <button onClick={() => ecrire(supabase.from("contrats").delete().eq("id", c.id))}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-ciel-100 pt-3">
                  <div className="text-xs text-acier">
                    <p>{dateFr(c.date_debut)} → {c.date_fin ? dateFr(c.date_fin) : "indéterminé"}</p>
                    <div className="mt-1 flex gap-2">
                      <Tag tone={c.statut === "actif" ? "ok" : "muted"}>{c.statut}</Tag>
                      {c.statut === "actif" && finit && <Tag tone="wait">Échéance proche</Tag>}
                    </div>
                  </div>
                  <span className="font-mono text-sm tabular-nums">
                    {fmt(c.montant, c.devise)} <span className="text-xs text-acier">{c.devise}</span>
                  </span>
                </div>

                <div className="mt-3">
                  <Fichier
                    dossier="contrats" base={c.id} chemin={c.pdf_path} nom={c.pdf_nom}
                    libelle="Joindre le contrat signé (PDF)"
                    onChange={(v) => ecrire(
                      supabase.from("contrats").update({ pdf_path: v.path, pdf_nom: v.nom }).eq("id", c.id))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && (
        <FormSimple titre={edit.id ? "Modifier le contrat" : "Nouveau contrat"} v={edit} onClose={() => setEdit(null)} onSave={save}
          champs={[
            { k: "reference", l: "Référence", req: true },
            { k: "client_id", l: "Client", type: "select", options: d.clients.map((c) => ({ v: c.id, t: c.denomination })) },
            { k: "objet", l: "Objet" },
            { k: "date_debut", l: "Début", type: "date" },
            { k: "date_fin", l: "Fin", type: "date", hint: "Vide si durée indéterminée." },
            { k: "montant", l: "Montant", type: "number" },
            { k: "devise", l: "Devise", type: "select", options: [{ v: "USD", t: "USD" }, { v: "CDF", t: "CDF" }] },
            { k: "statut", l: "Statut", type: "select",
              options: ["actif", "suspendu", "termine", "resilie"].map((s) => ({ v: s, t: s })) },
          ]} />
      )}
    </div>
  );
}


/* ===================================================================== ÉQUIPE */

function Equipe({ d, peutEcrire, peutVoirArgent, ecrire, supabase }: P) {
  const [edit, setEdit] = useState<Partial<Employe> | null>(null);
  // Pas de matricule ici : la base le génère (séquence + défaut AT-00X).
  // Le calculer côté client, c'est se garantir un doublon le jour où deux
  // personnes créent une fiche au même moment.
  const vide = () => ({
    nom: "", poste: "", job_description: "",
    email: "", phone: "", date_embauche: today(), salaire: 0, devise: "USD" as Devise, actif: true,
  });

  const masse = d.employes.filter((e) => e.actif).reduce((s, e) => s + toCdf(e.salaire, e.devise, d.taux), 0);

  const save = async (x: Partial<Employe>) => {
    const { id, ...c } = x;
    const champs = { ...c, salaire: Number(c.salaire) };
    const ok = id
      ? await ecrire(supabase.from("employes").update(champs).eq("id", id))
      : await ecrire(supabase.from("employes").insert(champs));
    if (ok) setEdit(null);
  };

  return (
    <div className="space-y-6">
      <Titre action={peutEcrire && <Btn variant="primary" onClick={() => setEdit(vide())}><Plus size={15} /> Ajouter</Btn>}>
        Équipe
      </Titre>
      {peutEcrire && (
        <p className="-mt-4 text-sm text-acier">
          Masse salariale mensuelle : <Money cdf={masse} size="sm" tone="text-navy-900" />
        </p>
      )}

      {d.employes.length === 0 ? (
        <Empty icon={UserCog} titre={peutEcrire ? "Personne pour l'instant." : "Les fiches de paie ne sont visibles que par la direction et la finance."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.employes.map((e) => (
            <div key={e.id} className="rounded-xl bg-white p-4 shadow-carte ring-1 ring-ciel-100 transition-shadow hover:shadow-leve">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-acier">{e.matricule}</p>
                  <p className="mt-1 truncate font-medium">{e.nom}</p>
                  <p className="truncate text-xs text-acier">{e.poste}</p>
                  {e.job_description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-ciel-300">{e.job_description}</p>
                  )}
                </div>
                {peutEcrire && (
                  <div className="flex shrink-0">
                    <button onClick={() => setEdit(e)} className="rounded p-1.5 text-acier hover:bg-ciel-100"><Pencil size={14} /></button>
                    <button onClick={() => ecrire(supabase.from("employes").delete().eq("id", e.id))}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-ciel-100 pt-3">
                <div>
                  <p className="text-xs text-acier">Depuis {dateFr(e.date_embauche)}</p>
                  {!e.actif && <Tag>Inactif</Tag>}
                </div>
                {/* Le salaire ne s'affiche qu'à qui a le droit de voir l'argent.
                    La RLS le protège déjà en base ; on évite en plus de tenter
                    de l'afficher. */}
                {peutVoirArgent && (
                  <span className="font-mono text-sm tabular-nums">
                    {fmt(e.salaire, e.devise)} <span className="text-xs text-acier">{e.devise}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <FormSimple titre={edit.id ? "Modifier" : "Nouveau membre"} v={edit} onClose={() => setEdit(null)} onSave={save}
          champs={[
            ...(edit.id
              ? [{ k: "matricule", l: "Matricule", disabled: true, hint: "Généré par la base. Non modifiable." }]
              : []),
            { k: "nom", l: "Nom complet", req: true },
            { k: "poste", l: "Poste", req: true },
            { k: "job_description", l: "Description de poste", type: "textarea" as const,
              hint: "Ce que la personne fait vraiment. Servira de base au contrat de travail." },
            { k: "date_embauche", l: "Date d'embauche", type: "date" as const },
            { k: "email", l: "Email", type: "email" as const },
            { k: "phone", l: "Téléphone" },
            { k: "salaire", l: "Salaire mensuel", type: "number" as const },
            { k: "devise", l: "Devise", type: "select" as const, options: [{ v: "USD", t: "USD" }, { v: "CDF", t: "CDF" }] },
          ]} />
      )}
    </div>
  );
}

/* ==================================================================== PROJETS */

function Projets({ d, ecrire, supabase }: P) {
  const [edit, setEdit] = useState<Partial<Projet> | null>(null);
  const nomClient = (id: string | null) => d.clients.find((c) => c.id === id)?.denomination ?? "Interne";

  const vide = (): Partial<Projet> => ({
    nom: "", client_id: "", description: "", url: "", statut: "en cours",
    echeance: "", responsables: [],
  });

  const save = async (x: Partial<Projet>) => {
    const { id, ...c } = x;
    const champs = {
      ...c,
      client_id: c.client_id || null,
      echeance: c.echeance || null,
      url: c.url || null,
      // On ne garde que les lignes réellement remplies : deux responsables vides
      // en base, ce sont deux lignes de bruit à filtrer partout ensuite.
      responsables: (c.responsables ?? []).filter((r) => r.nom.trim()),
    };
    const ok = id
      ? await ecrire(supabase.from("projets").update(champs).eq("id", id))
      : await ecrire(supabase.from("projets").insert(champs));
    if (ok) setEdit(null);
  };

  return (
    <div className="space-y-6">
      <Titre action={<Btn variant="primary" onClick={() => setEdit(vide())}><Plus size={15} /> Ajouter un projet</Btn>}>
        Projets
      </Titre>

      {d.projets.length === 0 ? (
        <Empty icon={Boxes} titre="Aucun projet."
          action={<Btn variant="primary" onClick={() => setEdit(vide())}><Plus size={15} /> Ajouter un projet</Btn>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.projets.map((p) => {
            const enRetard = p.echeance && p.echeance < today() && p.statut !== "livre";
            return (
              <div key={p.id} className="flex flex-col rounded-xl bg-white p-4 shadow-carte ring-1 ring-ciel-100 transition-shadow hover:shadow-leve">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.nom}</p>
                    <p className="truncate text-xs text-acier">{nomClient(p.client_id)}</p>
                  </div>
                  <div className="flex shrink-0">
                    <button onClick={() => setEdit(p)} className="rounded p-1.5 text-acier hover:bg-ciel-100"><Pencil size={14} /></button>
                    <button onClick={() => ecrire(supabase.from("projets").delete().eq("id", p.id))}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>

                {p.description && <p className="mt-2 line-clamp-2 text-xs text-acier">{p.description}</p>}

                {(p.responsables ?? []).length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {p.responsables.map((r, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ciel-100 font-mono text-[9px] text-navy-900">
                          {r.nom.split(" ").map((m) => m[0]).slice(0, 2).join("")}
                        </span>
                        <span className="truncate font-medium">{r.nom}</span>
                        {r.role && <span className="truncate text-ciel-300">· {r.role}</span>}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-ciel-100 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Tag tone={p.statut === "livre" ? "ok" : p.statut === "en cours" ? "wait" : "muted"}>{p.statut}</Tag>
                    {enRetard && <Tag tone="late">Échéance dépassée</Tag>}
                  </div>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-acier underline hover:text-navy-900">
                      <ExternalLink size={12} /> Ouvrir
                    </a>
                  )}
                </div>
                {p.echeance && (
                  <p className={`mt-1.5 text-xs ${enRetard ? "text-red-600" : "text-ciel-300"}`}>
                    Échéance : {dateFr(p.echeance)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {edit && <FormProjet v={edit} clients={d.clients} employes={d.employes}
        onSave={save} onClose={() => setEdit(null)} />}
    </div>
  );
}

function FormProjet({
  v: init, clients, employes, onSave, onClose,
}: {
  v: Partial<Projet>; clients: Client[]; employes: Employe[];
  onSave: (v: Partial<Projet>) => void; onClose: () => void;
}) {
  const [v, setV] = useState<Partial<Projet>>({ ...init, responsables: init.responsables ?? [] });
  const [err, setErr] = useState("");
  const maj = (k: keyof Projet) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });

  const resp = v.responsables ?? [];
  const majResp = (i: number, champ: keyof Responsable, val: string) => {
    const liste: Responsable[] = [...resp];
    while (liste.length <= i) liste.push({ employe_id: null, nom: "", role: "" });
    if (champ === "employe_id") {
      // Le nom est recopié : si la personne quitte l'entreprise et que sa fiche
      // disparaît, l'historique du projet reste lisible.
      const e = employes.find((x) => x.id === val);
      liste[i] = { ...liste[i], employe_id: val || null, nom: e?.nom ?? "" };
    } else {
      liste[i] = { ...liste[i], [champ]: val };
    }
    setV({ ...v, responsables: liste });
  };

  const valider = () => {
    if (!v.nom?.trim()) return setErr("Le nom du projet est obligatoire.");
    if (v.url && !/^https?:\/\//i.test(v.url)) return setErr("Le lien doit commencer par http:// ou https://");
    onSave(v);
  };

  return (
    <Modal title={v.id ? "Modifier le projet" : "Nouveau projet"} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom"><Input value={v.nom ?? ""} onChange={maj("nom")} placeholder="Mpangi_Pharma" /></Field>
          <Field label="Client">
            <Select value={v.client_id ?? ""} onChange={maj("client_id")}>
              <option value="">Interne</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.denomination}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <textarea rows={3} value={v.description ?? ""} onChange={maj("description")}
            placeholder="Ce que fait le projet, pour qui, et ce qui reste à livrer."
            className={inputCls} />
        </Field>

        {/* Responsables : deux au plus. Au-delà, plus personne n'est responsable. */}
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-acier">
            Responsables
          </span>
          <p className="mb-2 text-xs text-ciel-300">
            Deux au maximum. Au-delà, plus personne ne l'est vraiment.
          </p>
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={resp[i]?.employe_id ?? ""} onChange={(e) => majResp(i, "employe_id", e.target.value)}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">{i === 0 ? "— Responsable principal —" : "— Second responsable (facultatif) —"}</option>
                  {employes.filter((e) => e.actif).map((e) => (
                    <option key={e.id} value={e.id}>{e.nom}{e.poste ? ` — ${e.poste}` : ""}</option>
                  ))}
                </select>
                <input
                  value={resp[i]?.role ?? ""} onChange={(e) => majResp(i, "role", e.target.value)}
                  placeholder={i === 0 ? "Chef de projet" : "Développeur"}
                  className={`${inputCls} w-44`}
                />
              </div>
            ))}
          </div>
          {employes.filter((e) => e.actif).length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Aucun membre actif dans l'équipe : ajoutez-en un pour pouvoir désigner un responsable.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Statut">
            <Select value={v.statut} onChange={maj("statut")}>
              {["cadrage", "en cours", "livre", "maintenance", "en pause"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Échéance" hint="Vide si pas de date cible.">
            <Input type="date" value={v.echeance ?? ""} onChange={maj("echeance")} />
          </Field>
          <Field label="Lien" hint="Si le projet est un site en ligne.">
            <Input value={v.url ?? ""} onChange={maj("url")} placeholder="https://…" />
          </Field>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-2 border-t border-ciel-100 pt-4">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={valider}>Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}


/* ================================================================ PARAMÈTRES */

function Parametres({ d, peutEcrire, ecrire, supabase }: P) {
  const [taux, setTaux] = useState(d.taux);
  const [ok, setOk] = useState(false);

  return (
    <div className="max-w-2xl space-y-8">
      <Titre>Paramètres</Titre>

      <section className="rounded-lg bg-white p-5 ring-1 ring-ciel-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Building2 size={15} className="text-acier" /> Société</h2>
        <dl className="mt-4 space-y-2 text-sm">
          {[["Dénomination", SOCIETE.denomination], ["RCCM", SOCIETE.rccm], ["Id. Nat.", SOCIETE.idNat],
            ["Numéro Impôt", SOCIETE.nif], ["Siège", SOCIETE.siege], ["Ville", SOCIETE.ville]].map(([k, v]) => (
            <div key={k} className="flex gap-4">
              <dt className="w-32 shrink-0 text-acier">{k}</dt>
              <dd className="font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Capital et siège divergent entre les statuts et le RCCM. À régulariser avant d'imprimer quoi que ce soit d'officiel.
        </p>
      </section>

      <section className="rounded-lg bg-white p-5 ring-1 ring-ciel-100">
        <h2 className="text-sm font-semibold">Taux de change</h2>
        <p className="mt-1 text-xs text-acier">
          Proposé par défaut aux nouvelles opérations. Chaque facture et chaque dépense garde le taux de sa propre
          date : le modifier ici ne réécrit pas le passé.
        </p>
        <div className="mt-4 flex items-end gap-3">
          <Field label="1 USD =">
            <Input type="number" value={taux} onChange={(e) => setTaux(Number(e.target.value))} disabled={!peutEcrire} />
          </Field>
          {peutEcrire && (
            <Btn variant="primary" onClick={async () => {
              if (await ecrire(supabase.from("parametres").update({ valeur: taux }).eq("cle", "taux_usd_cdf"))) {
                setOk(true); setTimeout(() => setOk(false), 2000);
              }
            }}>
              {ok ? <><Check size={15} /> Enregistré</> : "Enregistrer"}
            </Btn>
          )}
        </div>
      </section>
    </div>
  );
}

/* ====================================================================== ADMIN */

function Admin({ d, profil, charger }: P) {
  const [ouvert, setOuvert] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const appel = async (method: "POST" | "PATCH", body: unknown) => {
    setErr(""); setMsg("");
    const r = await fetch("/api/admin/users", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.erreur ?? "Échec"); return false; }
    await charger();
    return true;
  };

  return (
    <div className="space-y-6">
      <Titre action={<Btn variant="primary" onClick={() => setOuvert(true)}><Plus size={15} /> Créer un compte</Btn>}>
        Comptes
      </Titre>

      <div className="rounded-lg border border-ciel-300 bg-ciel-50 px-4 py-3 text-xs text-acier">
        <p><strong className="text-navy-900">admin</strong> — tout, y compris la gestion des comptes.</p>
        <p><strong className="text-navy-900">finance</strong> — factures, encaissements, dépenses, salaires.</p>
        <p><strong className="text-navy-900">membre</strong> — clients, contrats, projets. Lecture des montants, pas d'écriture. Ne voit pas les salaires.</p>
      </div>

      {err && <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}

      <div className="overflow-x-auto rounded-xl bg-white shadow-carte ring-1 ring-ciel-100">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ciel-100 text-left text-xs uppercase tracking-wide text-acier">
            <tr>
              {["Nom", "Adresse email", "Rôle", "État"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ciel-100">
            {d.profiles.map((p) => (
              <tr key={p.id} className="hover:bg-ciel-50">
                <td className="px-4 py-3">
                  {p.full_name}
                  {p.id === profil.id && <span className="ml-2 text-xs text-acier">(vous)</span>}
                  {p.poste && <p className="text-xs text-acier">{p.poste}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={p.role} disabled={p.id === profil.id}
                    onChange={(e) => appel("PATCH", { id: p.id, role: e.target.value as Role })}
                    className="rounded border border-ciel-300 px-2 py-1 text-xs disabled:bg-ciel-50 disabled:text-acier"
                  >
                    {["admin", "finance", "membre"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Tag tone={p.is_active ? "ok" : "muted"}>{p.is_active ? "Actif" : "Désactivé"}</Tag>
                </td>
                <td className="px-4 py-3 text-right">
                  {p.id !== profil.id && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={async () => {
                          const mdp = prompt(`Nouveau mot de passe pour ${p.email} (10 caractères minimum)`);
                          if (mdp && await appel("PATCH", { id: p.id, password: mdp }))
                            setMsg(`Mot de passe changé. Transmettez-le à ${p.full_name} de vive voix.`);
                        }}
                        className="text-xs text-acier underline hover:text-navy-900"
                      >
                        Mot de passe
                      </button>
                      <button
                        onClick={() => appel("PATCH", { id: p.id, is_active: !p.is_active })}
                        className={`text-xs underline ${p.is_active ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {p.is_active ? "Désactiver" : "Réactiver"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ouvert && (
        <FormCompte
          onClose={() => setOuvert(false)}
          onSave={async (v) => {
            if (await appel("POST", v)) {
              setOuvert(false);
              setMsg(`Compte créé pour ${v.email}. Communiquez-lui le mot de passe de vive voix, pas par WhatsApp.`);
            }
          }}
        />
      )}
    </div>
  );
}

function FormCompte({
  onSave, onClose,
}: { onSave: (v: { email: string; full_name: string; poste: string; role: Role; password: string }) => void; onClose: () => void }) {
  const genere = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map((b) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 55]).join("") + "!7";

  const [v, setV] = useState({ email: "", full_name: "", poste: "", role: "membre" as Role, password: genere() });

  return (
    <Modal title="Créer un compte" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Adresse email" hint="L'adresse réelle : c'est l'identifiant de connexion.">
          <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })}
            placeholder="prenom@aksantictech.com" />
        </Field>
        <Field label="Nom complet">
          <Input value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
        </Field>
        <Field label="Poste">
          <Input value={v.poste} onChange={(e) => setV({ ...v, poste: e.target.value })} placeholder="Data Analyst" />
        </Field>
        <Field label="Rôle">
          <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
            <option value="membre">membre</option>
            <option value="finance">finance</option>
            <option value="admin">admin</option>
          </Select>
        </Field>
        <Field label="Mot de passe provisoire" hint="Généré aléatoirement. Transmettez-le de vive voix.">
          <div className="flex gap-2">
            <Input value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} className="font-mono" />
            <Btn onClick={() => setV({ ...v, password: genere() })}>Regénérer</Btn>
          </div>
        </Field>
        <div className="flex justify-end gap-2 border-t border-ciel-100 pt-4">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={() => onSave(v)}>Créer le compte</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ======================================================== FORMULAIRE GÉNÉRIQUE */

type Champ = {
  k: string; l: string; req?: boolean; hint?: string; disabled?: boolean;
  type?: "text" | "email" | "number" | "date" | "select" | "textarea";
  options?: { v: string; t: string }[];
};

function FormSimple<T extends Record<string, unknown>>({
  titre, v: init, champs, onSave, onClose,
}: { titre: string; v: T; champs: Champ[]; onSave: (v: T) => void; onClose: () => void }) {
  const [v, setV] = useState<T>(init);
  const [err, setErr] = useState("");

  const valider = () => {
    const manque = champs.filter((c) => c.req && !String(v[c.k] ?? "").trim());
    if (manque.length) return setErr(`Renseignez : ${manque.map((c) => c.l).join(", ")}`);
    onSave(v);
  };

  return (
    <Modal title={titre} onClose={onClose}>
      <div className="space-y-4">
        {champs.map((c) => (
          <Field key={c.k} label={c.l} hint={c.hint}>
            {c.type === "select" ? (
              <Select value={String(v[c.k] ?? "")} disabled={c.disabled}
                onChange={(e) => setV({ ...v, [c.k]: e.target.value } as T)}>
                {c.options!.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
              </Select>
            ) : c.type === "textarea" ? (
              <textarea
                rows={3} value={String(v[c.k] ?? "")} disabled={c.disabled}
                onChange={(e) => setV({ ...v, [c.k]: e.target.value } as T)}
                className={inputCls}
              />
            ) : (
              <Input type={c.type ?? "text"} value={String(v[c.k] ?? "")} disabled={c.disabled}
                onChange={(e) => setV({ ...v, [c.k]: e.target.value } as T)} />
            )}
          </Field>
        ))}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 border-t border-ciel-100 pt-4">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={valider}>Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}
