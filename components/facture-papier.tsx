"use client";

import { AksanticMark } from "./logo";
import { fmt, dateFr, toCdf, totalFacture, payeCdf, resteCdf, montantEnLettres, SOCIETE, SOCIETE_CONTACT } from "@/lib/money";
import type { Client, Facture, Paiement } from "@/lib/types";

/**
 * La facture, sur papier.
 *
 * Pas de bibliothèque PDF. Le navigateur sait déjà fabriquer un PDF conforme
 * depuis une page : Ctrl+P → « Enregistrer au format PDF ». On lui donne une
 * feuille A4 correctement composée et des règles @media print, et on récupère
 * un vectoriel propre — logo compris — sans alourdir l'application d'un mégaoctet
 * de dépendance, ni redessiner la mise en page une deuxième fois dans une API.
 *
 * Contrainte assumée : le nom du fichier et les marges dépendent de la boîte de
 * dialogue du navigateur. En échange, ce qu'on voit est exactement ce qu'on imprime.
 */

export function FacturePapier({
  f, client, paiements,
}: { f: Facture; client: Client | undefined; paiements: Paiement[] }) {
  const total = totalFacture(f);
  const paye = payeCdf(paiements);
  const reste = Math.max(0, resteCdf(f, paiements));
  const totalCdf = toCdf(total, f.devise, f.taux);

  return (
    <div className="facture-papier mx-auto w-full max-w-[210mm] bg-white p-10 text-navy-900">
      {/* ------------------------------------------------------------ en-tête */}
      <header className="flex items-start justify-between gap-8 border-b-2 border-navy-900 pb-5">
        <div className="flex items-center gap-3">
          {/* Le logo reste vectoriel : net à l'impression, quel que soit le zoom. */}
          <AksanticMark size={62} anime={false} />
          <div className="leading-none">
            <p className="font-display text-2xl font-extrabold tracking-tight">AKSANTIC</p>
            <p className="mt-1 font-display text-[8px] font-bold tracking-[0.32em] text-orchidee">
              TECHNOLOGY
            </p>
          </div>
        </div>

        <div className="text-right">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">FACTURE</h1>
          <p className="mt-1 font-mono text-sm font-semibold">{f.numero}</p>
        </div>
      </header>

      {/* --------------------------------------------- émetteur et destinataire */}
      <section className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-acier">Émetteur</p>
          <p className="text-sm font-semibold">{SOCIETE.denomination}</p>
          <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-navy-700">
            <p>{SOCIETE.siege}</p>
            <p>{SOCIETE.ville}</p>
            <p className="pt-1 font-mono text-[10px]">RCCM : {SOCIETE.rccm}</p>
            <p className="font-mono text-[10px]">Id. Nat. : {SOCIETE.idNat}</p>
            <p className="font-mono text-[10px]">N° Impôt : {SOCIETE.nif}</p>
            <p className="pt-1">{SOCIETE_CONTACT.tel} · {SOCIETE_CONTACT.email}</p>
            <p className="text-orchidee-600">{SOCIETE_CONTACT.site}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-acier">Facturé à</p>
          <div className="rounded-lg bg-ciel-50 p-4">
            <p className="text-sm font-semibold">{client?.denomination ?? "—"}</p>
            <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-navy-700">
              {client?.contact && <p>À l'attention de {client.contact}</p>}
              {client?.adresse && <p>{client.adresse}</p>}
              {client?.rccm && <p className="font-mono text-[10px]">RCCM : {client.rccm}</p>}
              {client?.nif && <p className="font-mono text-[10px]">N° Impôt : {client.nif}</p>}
              {client?.email && <p>{client.email}</p>}
              {client?.phone && <p>{client.phone}</p>}
            </div>
          </div>

          <dl className="mt-3 space-y-1 text-[11px]">
            <div className="flex justify-between"><dt className="text-acier">Date d'émission</dt><dd className="font-medium">{dateFr(f.date)}</dd></div>
            <div className="flex justify-between"><dt className="text-acier">Échéance</dt><dd className="font-medium">{dateFr(f.echeance)}</dd></div>
            {f.devise === "USD" && (
              <div className="flex justify-between">
                <dt className="text-acier">Taux appliqué</dt>
                <dd className="font-mono">1 USD = {fmt(f.taux)} FC</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {f.objet && (
        <p className="mt-6 text-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-acier">Objet — </span>
          {f.objet}
        </p>
      )}

      {/* ------------------------------------------------------------- lignes */}
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-b border-navy-900 text-left text-[10px] uppercase tracking-widest text-acier">
            <th className="pb-2 font-bold">Désignation</th>
            <th className="pb-2 text-right font-bold">Qté</th>
            <th className="pb-2 text-right font-bold">Prix unitaire</th>
            <th className="pb-2 text-right font-bold">Montant</th>
          </tr>
        </thead>
        <tbody>
          {f.lignes.map((l, i) => (
            <tr key={i} className="saut-evite border-b border-ciel-100">
              <td className="py-2.5 pr-4">{l.designation || <span className="text-ciel-300">—</span>}</td>
              <td className="py-2.5 text-right font-mono tabular-nums">{l.qte}</td>
              <td className="py-2.5 text-right font-mono tabular-nums">{fmt(l.pu, f.devise)}</td>
              <td className="py-2.5 text-right font-mono font-medium tabular-nums">
                {fmt(Number(l.qte) * Number(l.pu), f.devise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ------------------------------------------------------------- totaux */}
      <section className="saut-evite mt-5 flex justify-end">
        <div className="w-72">
          <div className="flex items-baseline justify-between border-t-2 border-navy-900 pt-3">
            <span className="font-display text-sm font-bold uppercase tracking-wide">Total</span>
            <span className="font-mono text-xl font-bold tabular-nums">
              {fmt(total, f.devise)} <span className="text-xs font-normal text-acier">{f.devise}</span>
            </span>
          </div>

          {f.devise === "USD" && (
            <div className="mt-1 flex items-baseline justify-between text-xs text-acier">
              <span>Contre-valeur</span>
              <span className="font-mono tabular-nums">{fmt(totalCdf)} FC</span>
            </div>
          )}

          {paye > 0 && (
            <>
              <div className="mt-2.5 flex items-baseline justify-between border-t border-ciel-100 pt-2 text-xs">
                <span className="text-acier">Déjà réglé</span>
                <span className="font-mono tabular-nums text-emerald-700">− {fmt(paye)} FC</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between rounded bg-ciel-50 px-2.5 py-2">
                <span className="text-xs font-bold uppercase tracking-wide">Reste dû</span>
                <span className="font-mono font-bold tabular-nums">{fmt(reste)} FC</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Le montant en toutes lettres : c'est lui qui fait foi en cas de litige. */}
      <p className="saut-evite mt-4 rounded-lg border border-ciel-100 bg-ciel-50 px-4 py-3 text-[11px] leading-relaxed">
        <span className="font-bold uppercase tracking-widest text-acier">Arrêtée à la somme de </span>
        <span className="font-medium italic">{montantEnLettres(total, f.devise)}.</span>
      </p>

      {paiements.length > 0 && (
        <section className="saut-evite mt-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-acier">Encaissements</p>
          <table className="w-full text-[11px]">
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id} className="border-b border-ciel-100">
                  <td className="py-1.5 font-mono text-acier">{dateFr(p.date)}</td>
                  <td className="py-1.5">{p.compte}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {fmt(p.montant, p.devise)} {p.devise}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-acier">
                    {fmt(toCdf(p.montant, p.devise, p.taux))} FC
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ------------------------------------------------------------- pied */}
      <footer className="saut-evite mt-10 border-t border-ciel-100 pt-4">
        <div className="flex items-end justify-between gap-8">
          <p className="max-w-[60%] text-[9px] leading-relaxed text-acier">
            {SOCIETE.denomination} — RCCM {SOCIETE.rccm} · Id. Nat. {SOCIETE.idNat} · N° Impôt {SOCIETE.nif}
            <br />
            {SOCIETE.siege}, {SOCIETE.ville} · {SOCIETE_CONTACT.tel} · {SOCIETE_CONTACT.email} · {SOCIETE_CONTACT.site}
          </p>
          <div className="text-center">
            <div className="h-14 w-40 border-b border-navy-900" />
            <p className="mt-1 text-[9px] uppercase tracking-widest text-acier">Pour Aksantic Technology</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
