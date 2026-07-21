"use client";

import { useMemo } from "react";
import { TrendingUp, Users, Boxes, Mail, ScrollText, UserCog } from "lucide-react";
import { toCdf, fmt, totalFacture, payeCdf, resteCdf, etatFacture, today, depenseSortieCdf, depenseARembourser } from "@/lib/money";
import type { P } from "./shared";
import { Money, Tag } from "./ui";

/**
 * Synthèse.
 *
 * Le Registre raconte ce qui s'est passé, dans l'ordre. La Synthèse répond à
 * quatre questions : est-ce qu'on vend, est-ce qu'on encaisse, où part l'argent,
 * et qu'est-ce qui traîne. Rien d'autre n'a sa place ici.
 *
 * Aucune bibliothèque de graphiques : des barres en CSS suffisent, se chargent
 * instantanément et ne pèsent rien sur une connexion lente.
 */

const MOIS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];

function Carte({ titre, children, icone: Icone }: {
  titre: string; children: React.ReactNode;
  icone: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-carte ring-1 ring-ciel-100">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Icone size={15} className="text-acier" /> {titre}
      </h2>
      {children}
    </section>
  );
}

function Barres({ lignes, max }: { lignes: { label: string; valeur: number; couleur: string }[]; max: number }) {
  return (
    <div className="space-y-2.5">
      {lignes.map((l, i) => (
        <div key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs text-acier">{l.label}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums">{fmt(l.valeur)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ciel-50">
            <div className={`h-full rounded-full ${l.couleur}`}
              style={{ width: `${max > 0 ? Math.max(2, (l.valeur / max) * 100) : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Synthese({ d, peutEcrire }: P) {
  const pmts = (id: string) => d.paiements.filter((p) => p.facture_id === id);

  const k = useMemo(() => {
    const emises = d.factures.filter((f) => f.statut === "emise");
    const facture = emises.reduce((s, f) => s + toCdf(totalFacture(f), f.devise, f.taux), 0);
    const encaisse = emises.reduce((s, f) => s + payeCdf(pmts(f.id)), 0);
    const attente = emises.reduce((s, f) => s + Math.max(0, resteCdf(f, pmts(f.id))), 0);
    const retard = emises.filter((f) => etatFacture(f, pmts(f.id)).tone === "late");
    const sorties = d.depenses.reduce((s, x) => s + depenseSortieCdf(x), 0);
    const aRembourser = d.depenses.reduce((s, x) => s + depenseARembourser(x), 0);

    // Délai moyen d'encaissement, sur les factures soldées uniquement : inclure
    // les impayées ferait descendre artificiellement la moyenne.
    const soldees = emises.filter((f) => resteCdf(f, pmts(f.id)) <= 1 && pmts(f.id).length);
    const delais = soldees.map((f) => {
      const dernier = pmts(f.id).map((p) => p.date).sort().at(-1)!;
      return Math.max(0, Math.floor((+new Date(dernier) - +new Date(f.date)) / 86400000));
    });
    const dso = delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null;

    return {
      facture, encaisse, attente, sorties, aRembourser, retard,
      recouvrement: facture > 0 ? (encaisse / facture) * 100 : 0,
      marge: encaisse - sorties,
      dso,
    };
  }, [d]);

  /** Six derniers mois : facturé, encaissé, dépensé. */
  const mensuel = useMemo(() => {
    const mois: { cle: string; label: string; facture: number; encaisse: number; depense: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push({
        cle: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
        label: MOIS[dt.getMonth()], facture: 0, encaisse: 0, depense: 0,
      });
    }
    const trouve = (date: string) => mois.find((m) => date.startsWith(m.cle));
    d.factures.filter((f) => f.statut === "emise").forEach((f) => {
      trouve(f.date) && (trouve(f.date)!.facture += toCdf(totalFacture(f), f.devise, f.taux));
    });
    d.paiements.forEach((p) => {
      trouve(p.date) && (trouve(p.date)!.encaisse += toCdf(p.montant, p.devise, p.taux));
    });
    d.depenses.forEach((x) => {
      trouve(x.date) && (trouve(x.date)!.depense += depenseSortieCdf(x));
    });
    return mois;
  }, [d]);

  const maxMensuel = Math.max(1, ...mensuel.flatMap((m) => [m.facture, m.encaisse, m.depense]));

  const topClients = useMemo(() => {
    const m: Record<string, number> = {};
    d.factures.filter((f) => f.statut === "emise").forEach((f) => {
      m[f.client_id] = (m[f.client_id] || 0) + toCdf(totalFacture(f), f.devise, f.taux);
    });
    return Object.entries(m)
      .map(([id, v]) => ({ label: d.clients.find((c) => c.id === id)?.denomination ?? "—", valeur: v, couleur: "bg-navy-900" }))
      .sort((a, b) => b.valeur - a.valeur).slice(0, 5);
  }, [d]);

  const topDepenses = useMemo(() => {
    const m: Record<string, number> = {};
    d.depenses.forEach((x) => { m[x.categorie] = (m[x.categorie] || 0) + depenseSortieCdf(x); });
    return Object.entries(m)
      .map(([c, v]) => ({ label: c, valeur: v, couleur: "bg-red-400" }))
      .sort((a, b) => b.valeur - a.valeur).slice(0, 6);
  }, [d]);

  const contratsActifs = d.contrats.filter((c) => c.statut === "actif");
  const lettresEnAttente = d.lettres.filter((l) => l.sens === "transmise" && l.statut === "envoye");
  const projetsEnCours = d.projets.filter((p) => p.statut === "en cours");
  const projetsEnRetard = d.projets.filter((p) => p.echeance && p.echeance < today() && p.statut !== "livre");
  const masse = d.employes.filter((e) => e.actif).reduce((s, e) => s + toCdf(e.salaire, e.devise, d.taux), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Synthèse</h1>
        <p className="mt-1 text-sm text-acier">
          Est-ce qu'on vend, est-ce qu'on encaisse, où part l'argent, qu'est-ce qui traîne.
        </p>
      </header>

      {/* Indicateurs de tête */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-ciel-100 shadow-carte ring-1 ring-ciel-100 lg:grid-cols-4">
        {[
          { l: "Facturé", v: <Money cdf={k.facture} size="xl" />, s: `${d.factures.filter((f) => f.statut === "emise").length} factures émises` },
          { l: "Encaissé", v: <Money cdf={k.encaisse} size="xl" tone="text-emerald-600" />, s: `${k.recouvrement.toFixed(0)} % du facturé` },
          { l: "En attente", v: <Money cdf={k.attente} size="xl" tone="text-amber-600" />, s: `dont ${k.retard.length} en retard` },
          { l: "Solde", v: <Money cdf={k.marge} size="xl" tone={k.marge >= 0 ? "text-navy-900" : "text-red-600"} />, s: "encaissé − dépenses" },
        ].map((x) => (
          <div key={x.l} className="bg-white px-4 py-5">
            <p className="text-xs uppercase tracking-wide text-acier">{x.l}</p>
            <p className="mt-2">{x.v}</p>
            <p className="mt-1 text-xs text-ciel-300">{x.s}</p>
          </div>
        ))}
      </section>

      {/* Six mois */}
      <Carte titre="Six derniers mois" icone={TrendingUp}>
        <div className="flex items-end gap-3 overflow-x-auto pb-2">
          {mensuel.map((m) => (
            <div key={m.cle} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end justify-center gap-1">
                {[
                  { v: m.facture, c: "bg-ciel-300", t: "Facturé" },
                  { v: m.encaisse, c: "bg-navy-900", t: "Encaissé" },
                  { v: m.depense, c: "bg-red-400", t: "Dépensé" },
                ].map((b, i) => (
                  <div key={i} title={`${b.t} : ${fmt(b.v)} FC`}
                    className={`w-2.5 rounded-t ${b.c} transition-all`}
                    style={{ height: `${Math.max(2, (b.v / maxMensuel) * 100)}%` }} />
                ))}
              </div>
              <span className="text-xs text-acier">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-ciel-100 pt-3 text-xs text-acier">
          {[["bg-ciel-300", "Facturé"], ["bg-navy-900", "Encaissé"], ["bg-red-400", "Dépensé"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-sm ${c}`} /> {l}
            </span>
          ))}
          {k.dso !== null && (
            <span className="ml-auto">
              Délai moyen d'encaissement : <strong className="font-mono text-navy-900">{k.dso} j</strong>
            </span>
          )}
        </div>
      </Carte>

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="Principaux clients" icone={Users}>
          {topClients.length === 0
            ? <p className="text-xs text-acier">Aucune facture émise.</p>
            : <Barres lignes={topClients} max={topClients[0].valeur} />}
        </Carte>

        <Carte titre="Où part l'argent" icone={TrendingUp}>
          {topDepenses.length === 0
            ? <p className="text-xs text-acier">Aucune dépense enregistrée.</p>
            : <Barres lignes={topDepenses} max={topDepenses[0].valeur} />}
        </Carte>
      </div>

      {/* Ce qui traîne */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Carte titre="Contrats" icone={ScrollText}>
          <p className="chiffre text-2xl">{contratsActifs.length}</p>
          <p className="text-xs text-acier">actifs</p>
          <p className="mt-3 border-t border-ciel-100 pt-3 text-xs text-acier">
            {d.contrats.filter((c) => c.pdf_path).length} / {d.contrats.length} avec PDF joint
          </p>
        </Carte>

        <Carte titre="Projets" icone={Boxes}>
          <p className="chiffre text-2xl">{projetsEnCours.length}</p>
          <p className="text-xs text-acier">en cours</p>
          <p className="mt-3 border-t border-ciel-100 pt-3 text-xs">
            {projetsEnRetard.length > 0
              ? <span className="text-red-600">{projetsEnRetard.length} au-delà de l'échéance</span>
              : <span className="text-acier">Aucun retard</span>}
          </p>
        </Carte>

        <Carte titre="Courrier" icone={Mail}>
          <p className="chiffre text-2xl">{lettresEnAttente.length}</p>
          <p className="text-xs text-acier">sans accusé</p>
          <p className="mt-3 border-t border-ciel-100 pt-3 text-xs text-acier">
            {d.lettres.filter((l) => l.sens === "recue").length} courriers reçus
          </p>
        </Carte>

        <Carte titre="Équipe" icone={UserCog}>
          <p className="chiffre text-2xl">{d.employes.filter((e) => e.actif).length}</p>
          <p className="text-xs text-acier">en poste</p>
          {peutEcrire && (
            <p className="mt-3 border-t border-ciel-100 pt-3 text-xs text-acier">
              Masse salariale <Money cdf={masse} size="sm" tone="text-navy-900" />
            </p>
          )}
        </Carte>
      </div>

      {k.retard.length > 0 && (
        <Carte titre={`Factures en retard (${k.retard.length})`} icone={TrendingUp}>
          <ul className="divide-y divide-ciel-100">
            {k.retard.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-mono text-xs text-acier">{f.numero}</span>{" "}
                    {d.clients.find((c) => c.id === f.client_id)?.denomination}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Tag tone="late">{etatFacture(f, pmts(f.id)).label}</Tag>
                  <Money cdf={Math.max(0, resteCdf(f, pmts(f.id)))} size="sm" tone="text-red-600" />
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}
