"use client";

import { useMemo, useState } from "react";
import { Target, Pencil, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { toCdf, fmt, totalFacture, SOCIETE } from "@/lib/money";
import {
  projeter12Mois, projeter3Ans, prevuMoisCdf, HYPOTHESES_DEFAUT,
  type Budget, type Hypotheses, type ChargeFixe,
} from "@/lib/budget";
import type { P } from "./shared";
import { Btn, Input, Field, Modal, Empty, Money } from "./ui";

/**
 * Budget prévisionnel.
 *
 * Le classeur Excel projetait dans le vide : des hypothèses, des courbes, aucun
 * ancrage dans le réel. Ici, la projection SERT DE RÉFÉRENCE au réel. La seule
 * vue qui compte est « prévu vs encaissé » : c'est elle qui dit si le plan tient.
 */

const MOIS_COURTS = ["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];

export function BudgetVue({ d, peutEcrire, ecrire, supabase }: P) {
  const budget = d.budgets.find((b) => b.actif) ?? d.budgets[0];
  const [edit, setEdit] = useState<Budget | null>(null);
  const [onglet, setOnglet] = useState<"reel" | "mensuel" | "annuel">("reel");

  const save = async (b: Budget) => {
    const { id, ...champs } = b;
    const ok = await ecrire(
      supabase.from("budgets").update({
        hypotheses: champs.hypotheses,
        charges_fixes: champs.charges_fixes,
        devise: champs.devise,
        libelle: champs.libelle,
        updated_at: new Date().toISOString(),
      }).eq("id", id),
    );
    if (ok) setEdit(null);
  };

  if (!budget) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Budget</h1>
        <Empty icon={Target} titre="Aucun budget. Exécutez supabase/migration-004.sql pour créer le prévisionnel de départ." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Budget {budget.annee}</h1>
          <p className="mt-1 text-sm text-acier">{budget.libelle} · en {budget.devise}</p>
        </div>
        {peutEcrire && (
          <Btn variant="primary" onClick={() => setEdit(budget)}>
            <Pencil size={15} /> Ajuster les hypothèses
          </Btn>
        )}
      </div>

      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-carte ring-1 ring-ciel-100">
        {([
          { v: "reel", l: "Prévu vs réel" },
          { v: "mensuel", l: "Projection 12 mois" },
          { v: "annuel", l: "Projection 3 ans" },
        ] as const).map((o) => (
          <button
            key={o.v} onClick={() => setOnglet(o.v)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
              onglet === o.v ? "bg-navy-900 font-medium text-white" : "text-acier hover:bg-ciel-50"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {onglet === "reel" && <PrevuVsReel budget={budget} d={d} />}
      {onglet === "mensuel" && <Projection12 budget={budget} />}
      {onglet === "annuel" && <Projection3Ans budget={budget} />}

      {edit && <FormBudget b={edit} onSave={save} onClose={() => setEdit(null)} />}
    </div>
  );
}

/* ------------------------------------------------ le cœur : prévu contre réel */

function PrevuVsReel({ budget, d }: { budget: Budget; d: P["d"] }) {
  const lignes = useMemo(() => {
    const annee = budget.annee;

    // Réel, par mois de l'année du budget. Le réel est en CDF ; on y ramène tout.
    const caReel = Array(12).fill(0);
    const depReel = Array(12).fill(0);

    d.factures.filter((f) => f.statut === "emise" && f.date.startsWith(`${annee}`)).forEach((f) => {
      const m = new Date(f.date + "T00:00:00").getMonth();
      caReel[m] += toCdf(totalFacture(f), f.devise, f.taux);
    });
    d.depenses.filter((x) => x.date.startsWith(`${annee}`)).forEach((x) => {
      const m = new Date(x.date + "T00:00:00").getMonth();
      depReel[m] += toCdf(x.montant, x.devise, x.taux);
    });

    return MOIS_COURTS.map((label, i) => {
      const { caPrevuCdf, chargesPrevuCdf } = prevuMoisCdf(budget, i, d.taux);
      const ecartCa = caPrevuCdf > 0 ? (caReel[i] - caPrevuCdf) / caPrevuCdf : null;
      return {
        label, caPrevu: caPrevuCdf, caReel: caReel[i], ecartCa,
        depPrevu: chargesPrevuCdf, depReel: depReel[i],
        actif: caReel[i] > 0 || depReel[i] > 0,
      };
    });
  }, [budget, d]);

  const cumul = lignes.reduce((a, l) => ({
    caPrevu: a.caPrevu + l.caPrevu, caReel: a.caReel + l.caReel,
    depPrevu: a.depPrevu + l.depPrevu, depReel: a.depReel + l.depReel,
  }), { caPrevu: 0, caReel: 0, depPrevu: 0, depReel: 0 });

  const ecartGlobal = cumul.caPrevu > 0 ? (cumul.caReel - cumul.caPrevu) / cumul.caPrevu : 0;
  const moisActifs = lignes.filter((l) => l.actif).length;

  return (
    <div className="space-y-6">
      {moisActifs === 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-white p-4 text-sm text-acier shadow-carte ring-1 ring-ciel-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <p>
            Aucune facture ni dépense sur {budget.annee} pour l'instant. Le tableau
            se remplira à mesure que vous saisissez le réel — c'est là que la
            comparaison prend son sens.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Bilan titre="CA prévu (cumul)" valeur={cumul.caPrevu} tone="text-acier" />
        <Bilan titre="CA réel (cumul)" valeur={cumul.caReel} tone="text-navy-900" />
        <div className="rounded-xl bg-white p-5 shadow-carte ring-1 ring-ciel-100">
          <p className="text-xs uppercase tracking-wide text-acier">Écart</p>
          <p className={`mt-2 flex items-center gap-2 chiffre text-2xl ${ecartGlobal >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {ecartGlobal >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {ecartGlobal >= 0 ? "+" : ""}{(ecartGlobal * 100).toFixed(0)} %
          </p>
          <p className="mt-1 text-xs text-ciel-300">réel vs prévu, sur l'année</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-carte ring-1 ring-ciel-100">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-ciel-100 text-left text-xs uppercase tracking-wide text-acier">
            <tr>
              <th className="px-4 py-3 font-medium">Mois</th>
              <th className="px-4 py-3 text-right font-medium">CA prévu</th>
              <th className="px-4 py-3 text-right font-medium">CA réel</th>
              <th className="px-4 py-3 text-right font-medium">Écart</th>
              <th className="px-4 py-3 text-right font-medium">Charges prévues</th>
              <th className="px-4 py-3 text-right font-medium">Dépenses réelles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ciel-100">
            {lignes.map((l) => (
              <tr key={l.label} className={l.actif ? "" : "opacity-45"}>
                <td className="px-4 py-2.5 font-medium capitalize">{l.label}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs text-acier">{fmt(l.caPrevu)}</td>
                <td className="px-4 py-2.5 text-right chiffre">{l.caReel > 0 ? fmt(l.caReel) : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  {l.actif && l.ecartCa !== null ? (
                    <span className={`chiffre text-xs ${l.ecartCa >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {l.ecartCa >= 0 ? "+" : ""}{(l.ecartCa * 100).toFixed(0)} %
                    </span>
                  ) : <span className="text-ciel-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right chiffre text-xs text-acier">{fmt(l.depPrevu)}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs">
                  {l.depReel > 0 ? <span className="text-red-600">{fmt(l.depReel)}</span> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-ciel-100 font-semibold">
            <tr>
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right chiffre text-xs">{fmt(cumul.caPrevu)}</td>
              <td className="px-4 py-3 text-right chiffre">{fmt(cumul.caReel)}</td>
              <td className="px-4 py-3 text-right">
                <span className={`chiffre text-xs ${ecartGlobal >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {ecartGlobal >= 0 ? "+" : ""}{(ecartGlobal * 100).toFixed(0)} %
                </span>
              </td>
              <td className="px-4 py-3 text-right chiffre text-xs">{fmt(cumul.depPrevu)}</td>
              <td className="px-4 py-3 text-right chiffre text-xs text-red-600">{fmt(cumul.depReel)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-ciel-300">
        Le prévu vient des hypothèses, converti en francs au taux du jour ({fmt(d.taux)} FC/USD).
        Le réel vient de vos factures émises et de vos dépenses. Un mois grisé n'a pas encore de réel saisi.
      </p>
    </div>
  );
}

function Bilan({ titre, valeur, tone }: { titre: string; valeur: number; tone: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-carte ring-1 ring-ciel-100">
      <p className="text-xs uppercase tracking-wide text-acier">{titre}</p>
      <p className="mt-2"><Money cdf={valeur} size="xl" tone={tone} /></p>
    </div>
  );
}

/* ------------------------------------------------------ projection 12 mois */

function Projection12({ budget }: { budget: Budget }) {
  const mois = useMemo(() => projeter12Mois(budget.hypotheses, budget.charges_fixes), [budget]);
  const u = (v: number) => `${fmt(v, budget.devise)} ${budget.devise}`;
  const maxCa = Math.max(...mois.map((m) => m.ca));

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-5 shadow-carte ring-1 ring-ciel-100">
        <h3 className="mb-4 text-sm font-semibold">Chiffre d'affaires projeté</h3>
        <div className="flex items-end gap-2" style={{ height: 140 }}>
          {mois.map((m) => (
            <div key={m.index} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end justify-center" style={{ height: 110 }}>
                <div className="w-full rounded-t bg-navy-900" style={{ height: `${(m.ca / maxCa) * 100}%` }}
                  title={`${m.label} : ${u(m.ca)}`} />
              </div>
              <span className="text-[10px] text-acier">{MOIS_COURTS[m.index]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-carte ring-1 ring-ciel-100">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-ciel-100 text-left text-xs uppercase tracking-wide text-acier">
            <tr>
              <th className="px-4 py-3 font-medium">Mois</th>
              <th className="px-4 py-3 text-right font-medium">CA</th>
              <th className="px-4 py-3 text-right font-medium">Masse salariale</th>
              <th className="px-4 py-3 text-right font-medium">Charges</th>
              <th className="px-4 py-3 text-right font-medium">EBE</th>
              <th className="px-4 py-3 text-right font-medium">Résultat net</th>
              <th className="px-4 py-3 text-right font-medium">Trésorerie cumulée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ciel-100">
            {mois.map((m) => (
              <tr key={m.index}>
                <td className="px-4 py-2.5 font-medium">{m.label}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs">{u(m.ca)}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs text-acier">{u(m.masseSalariale)}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs text-acier">{u(m.chargesExploitation)}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs">{u(m.ebe)}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs font-medium">{u(m.resultatNet)}</td>
                <td className="px-4 py-2.5 text-right chiffre text-xs text-emerald-700">{u(m.tresorerieCumulee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- projection 3 ans */

function Projection3Ans({ budget }: { budget: Budget }) {
  const annees = useMemo(() => projeter3Ans(budget.hypotheses, budget.charges_fixes), [budget]);
  const u = (v: number) => `${fmt(v, budget.devise)} ${budget.devise}`;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {annees.map((a) => (
        <div key={a.annee} className="rounded-xl bg-white p-5 shadow-carte ring-1 ring-ciel-100">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg font-bold">Année {a.annee}</h3>
            <span className={`chiffre text-sm ${a.margeNette >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              marge {(a.margeNette * 100).toFixed(0)} %
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Chiffre d'affaires", a.ca, "text-navy-900"],
              ["Masse salariale", a.masseSalariale, "text-acier"],
              ["Charges d'exploitation", a.chargesExploitation, "text-acier"],
              ["Résultat d'exploitation", a.ebe, "text-navy-900"],
              ["Impôt sociétés", a.is, "text-acier"],
            ].map(([l, v, t]) => (
              <div key={l as string} className="flex justify-between gap-2">
                <dt className="text-acier">{l as string}</dt>
                <dd className={`chiffre text-xs ${t as string}`}>{u(v as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-ciel-100 pt-2">
              <dt className="font-semibold">Résultat net</dt>
              <dd className="chiffre font-semibold text-emerald-700">{u(a.resultatNet)}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------- édition des hypothèses */

function FormBudget({ b, onSave, onClose }: { b: Budget; onSave: (b: Budget) => void; onClose: () => void }) {
  const [h, setH] = useState<Hypotheses>({ ...HYPOTHESES_DEFAUT, ...b.hypotheses });
  const [charges, setCharges] = useState<ChargeFixe[]>(b.charges_fixes.length ? b.charges_fixes : []);
  const [devise, setDevise] = useState(b.devise);

  const majH = (k: keyof Hypotheses, v: number | boolean) => setH({ ...h, [k]: v });
  const pct = (k: keyof Hypotheses) => (
    <Input type="number" step="0.01" value={h[k] as number}
      onChange={(e) => majH(k, Number(e.target.value))} />
  );

  return (
    <Modal title="Hypothèses budgétaires" onClose={onClose} wide>
      <div className="space-y-5">
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-acier">Chiffre d'affaires</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="CA de départ (mois 1)"><Input type="number" value={h.ca_depart_mensuel}
              onChange={(e) => majH("ca_depart_mensuel", Number(e.target.value))} /></Field>
            <Field label="Croissance mensuelle" hint="0.03 = +3 %/mois">{pct("croissance_mensuelle")}</Field>
            <Field label="Croissance annuelle" hint="Années 2 et 3">{pct("croissance_annuelle")}</Field>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-acier">Personnel</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            {h.salaires.map((s, i) => (
              <Field key={i} label={`Salaire brut — employé ${i + 1}`}>
                <Input type="number" value={s} onChange={(e) => {
                  const sal = [...h.salaires]; sal[i] = Number(e.target.value); setH({ ...h, salaires: sal });
                }} />
              </Field>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Btn onClick={() => setH({ ...h, salaires: [...h.salaires, 0] })}>+ Un salarié</Btn>
            {h.salaires.length > 1 && (
              <Btn variant="danger" onClick={() => setH({ ...h, salaires: h.salaires.slice(0, -1) })}>
                Retirer le dernier
              </Btn>
            )}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Charges patronales" hint="0.17 = CNSS+INPP+ONEM">{pct("charges_patronales")}</Field>
            <Field label="Augmentation annuelle" hint="Années 2 et 3">{pct("augmentation_salariale_annuelle")}</Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={h.ipr_actif}
                onChange={(e) => majH("ipr_actif", e.target.checked)}
                className="h-4 w-4 rounded border-ciel-300" />
              <span>Appliquer l'IPR ({(h.ipr * 100).toFixed(0)} %)</span>
            </label>
          </div>
          {!h.ipr_actif && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              L'IPR n'est pas appliqué — comme dans votre classeur d'origine. Votre masse salariale réelle
              sera plus lourde. Cochez la case pour un prévisionnel plus prudent.
            </p>
          )}
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-acier">Charges fixes mensuelles</h4>
          <div className="space-y-2">
            {charges.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input value={c.libelle} placeholder="Libellé"
                  onChange={(e) => { const l = [...charges]; l[i] = { ...l[i], libelle: e.target.value }; setCharges(l); }}
                  className="champ flex-1" />
                <input type="number" value={c.montant} placeholder="Montant"
                  onChange={(e) => { const l = [...charges]; l[i] = { ...l[i], montant: Number(e.target.value) }; setCharges(l); }}
                  className="champ w-32 text-right" />
                <button onClick={() => setCharges(charges.filter((_, j) => j !== i))}
                  className="rounded px-2 text-red-500 hover:bg-red-50">✕</button>
              </div>
            ))}
          </div>
          <Btn className="mt-2" onClick={() => setCharges([...charges, { libelle: "", montant: 0 }])}>
            + Un poste de charge
          </Btn>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-acier">Fiscalité & devise</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Impôt sociétés (IS)" hint="0.15 = 15 %">{pct("taux_is")}</Field>
            <Field label="Inflation des charges" hint="Années 2 et 3">{pct("inflation_charges_annuelle")}</Field>
            <Field label="Devise du budget">
              <select value={devise} onChange={(e) => setDevise(e.target.value as "USD" | "CDF")} className="champ">
                <option value="USD">USD</option><option value="CDF">CDF</option>
              </select>
            </Field>
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-ciel-100 pt-4">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={() => onSave({ ...b, hypotheses: h, charges_fixes: charges, devise })}>
            Enregistrer les hypothèses
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
