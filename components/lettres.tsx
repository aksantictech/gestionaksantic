"use client";

import { useMemo, useState } from "react";
import { Mail, Plus, Send, Inbox, Clock, Check } from "lucide-react";
import { dateFr, today } from "@/lib/money";
import type { Lettre, LettreSens, LettreStatut } from "@/lib/types";
import type { P } from "./shared";
import { Tag, Btn, Input, Select, Field, Modal, Empty } from "./ui";
import { Fichier } from "./fichier";

/**
 * Courrier — transmis et reçu.
 *
 * Le point du module n'est pas d'archiver du PDF : c'est de répondre à
 * « cette lettre est partie il y a combien de temps, et est-ce qu'on a
 * l'accusé ? ». Tout le reste est au service de cette question.
 */

const STATUTS: Record<LettreStatut, { label: string; tone: "muted" | "wait" | "ok" }> = {
  brouillon: { label: "Brouillon", tone: "muted" },
  envoye: { label: "Envoyée", tone: "wait" },
  receptionne: { label: "Réceptionnée", tone: "ok" },
};

const statutRecue: Record<LettreStatut, string> = {
  brouillon: "Enregistrée",
  envoye: "En traitement",
  receptionne: "Accusé donné",
};

export function Lettres({ d, ecrire, supabase }: P) {
  const [sens, setSens] = useState<LettreSens>("transmise");
  const [edit, setEdit] = useState<Partial<Lettre> | null>(null);

  const liste = d.lettres
    .filter((l) => l.sens === sens)
    .sort((a, b) => b.date_lettre.localeCompare(a.date_lettre));

  const reference = (s: LettreSens) => {
    const an = new Date().getFullYear();
    const prefixe = s === "transmise" ? "LT" : "LR";
    const n = d.lettres.filter((l) => l.reference.startsWith(`${prefixe}/${an}/`)).length + 1;
    return `${prefixe}/${an}/${String(n).padStart(3, "0")}`;
  };

  const vide = (s: LettreSens): Partial<Lettre> => ({
    reference: reference(s), sens: s, objet: "", correspondant: "", client_id: "",
    date_lettre: today(), date_envoi: null, date_reception: s === "recue" ? today() : null,
    porteur: "", contenu: "", statut: "brouillon",
  });

  const save = async (x: Partial<Lettre>) => {
    const { id, ...c } = x;
    const champs = {
      ...c,
      client_id: c.client_id || null,
      date_envoi: c.date_envoi || null,
      date_reception: c.date_reception || null,
    };
    const ok = id
      ? await ecrire(supabase.from("lettres").update(champs).eq("id", id))
      : await ecrire(supabase.from("lettres").insert(champs));
    if (ok) setEdit(null);
  };

  /** Le suivi : ce qui est parti et n'est jamais revenu. */
  const enAttente = useMemo(
    () => d.lettres
      .filter((l) => l.sens === "transmise" && l.statut === "envoye" && l.date_envoi)
      .map((l) => ({ l, jours: Math.floor((+new Date(today()) - +new Date(l.date_envoi!)) / 86400000) }))
      .sort((a, b) => b.jours - a.jours),
    [d.lettres],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Lettres</h1>
        <Btn variant="primary" onClick={() => setEdit(vide(sens))}>
          <Plus size={15} /> {sens === "transmise" ? "Nouvelle lettre" : "Enregistrer un courrier reçu"}
        </Btn>
      </div>

      {enAttente.length > 0 && sens === "transmise" && (
        <section className="overflow-hidden rounded-xl bg-white shadow-carte ring-1 ring-amber-200">
          <h2 className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <Clock size={15} /> En attente d'accusé de réception ({enAttente.length})
          </h2>
          <ul className="divide-y divide-ciel-100">
            {enAttente.map(({ l, jours }) => (
              <li key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{l.objet}</p>
                  <p className="truncate text-xs text-acier">
                    {l.correspondant} · envoyée le {dateFr(l.date_envoi)}
                  </p>
                </div>
                <span className={`shrink-0 font-mono text-sm ${jours > 14 ? "text-red-600" : "text-amber-600"}`}>
                  {jours} j
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-carte ring-1 ring-ciel-100">
        {([
          { v: "transmise", l: "Transmises", i: Send },
          { v: "recue", l: "Reçues", i: Inbox },
        ] as const).map((o) => (
          <button
            key={o.v} onClick={() => setSens(o.v)}
            className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
              sens === o.v ? "bg-navy-900 font-medium text-white" : "text-acier hover:bg-ciel-50"
            }`}
          >
            <o.i size={15} /> {o.l}
            <span className={`text-xs ${sens === o.v ? "text-ciel-300" : "text-ciel-300"}`}>
              {d.lettres.filter((l) => l.sens === o.v).length}
            </span>
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <Empty icon={Mail} titre={sens === "transmise" ? "Aucune lettre transmise." : "Aucun courrier reçu enregistré."}
          action={<Btn variant="primary" onClick={() => setEdit(vide(sens))}><Plus size={15} /> Ajouter</Btn>} />
      ) : (
        <div className="space-y-3">
          {liste.map((l) => (
            <div key={l.id} className="rounded-xl bg-white p-4 shadow-carte ring-1 ring-ciel-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-acier">{l.reference}</span>
                    <Tag tone={STATUTS[l.statut].tone}>
                      {l.sens === "transmise" ? STATUTS[l.statut].label : statutRecue[l.statut]}
                    </Tag>
                    {l.sens === "transmise" && l.statut === "receptionne" && !l.accuse_path && (
                      <Tag tone="wait">Accusé non joint</Tag>
                    )}
                  </div>
                  <p className="mt-1 font-medium">{l.objet}</p>
                  <p className="text-xs text-acier">
                    {l.sens === "transmise" ? "À " : "De "}{l.correspondant}
                    {l.porteur && ` · par ${l.porteur}`}
                  </p>
                </div>
                <Btn onClick={() => setEdit(l)}>Modifier</Btn>
              </div>

              <div className="mt-3 grid gap-3 border-t border-ciel-100 pt-3 sm:grid-cols-2">
                <div className="space-y-1 text-xs text-acier">
                  <p>Datée du {dateFr(l.date_lettre)}</p>
                  {l.date_envoi && <p>Envoyée le {dateFr(l.date_envoi)}</p>}
                  {l.date_reception && <p>Réceptionnée le {dateFr(l.date_reception)}</p>}
                </div>
                <div className="space-y-2">
                  <Fichier
                    dossier="lettres" base={l.id} chemin={l.lettre_path} nom={l.lettre_nom}
                    libelle="Joindre la lettre (PDF)"
                    onChange={(v) => ecrire(
                      supabase.from("lettres").update({ lettre_path: v.path, lettre_nom: v.nom }).eq("id", l.id))}
                  />
                  {l.sens === "transmise" && l.statut !== "brouillon" && (
                    <Fichier
                      dossier="lettres" base={l.id} chemin={l.accuse_path} nom={l.accuse_nom}
                      libelle="Joindre l'accusé de réception"
                      accept="application/pdf,image/*"
                      onChange={(v) => ecrire(
                        supabase.from("lettres").update({ accuse_path: v.path, accuse_nom: v.nom }).eq("id", l.id))}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && <FormLettre v={edit} clients={d.clients} onSave={save} onClose={() => setEdit(null)} />}
    </div>
  );
}

function FormLettre({
  v: init, clients, onSave, onClose,
}: { v: Partial<Lettre>; clients: { id: string; denomination: string }[]; onSave: (v: Partial<Lettre>) => void; onClose: () => void }) {
  const [v, setV] = useState(init);
  const [err, setErr] = useState("");
  const transmise = v.sens === "transmise";
  const maj = (k: keyof Lettre) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });

  const valider = () => {
    if (!v.objet?.trim() || !v.correspondant?.trim())
      return setErr("L'objet et le correspondant sont obligatoires.");
    // La base impose déjà ces règles. On les redit ici pour que le message soit
    // lisible plutôt qu'une erreur SQL brute.
    if (v.statut === "envoye" && !v.date_envoi)
      return setErr("Une lettre marquée envoyée doit porter sa date d'envoi.");
    if (v.statut === "receptionne" && !v.date_reception)
      return setErr("Une lettre réceptionnée doit porter sa date de réception.");
    onSave(v);
  };

  return (
    <Modal title={v.id ? `Lettre ${v.reference}` : transmise ? "Nouvelle lettre" : "Courrier reçu"} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Référence"><Input value={v.reference ?? ""} onChange={maj("reference")} /></Field>
          <Field label="Sens">
            <Select value={v.sens} onChange={maj("sens")} disabled={!!v.id}>
              <option value="transmise">Transmise (nous envoyons)</option>
              <option value="recue">Reçue (on nous écrit)</option>
            </Select>
          </Field>
        </div>

        <Field label="Objet">
          <Input value={v.objet ?? ""} onChange={maj("objet")} placeholder="Demande de rendez-vous — projet BI" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={transmise ? "Destinataire" : "Expéditeur"}>
            <Input value={v.correspondant ?? ""} onChange={maj("correspondant")} placeholder="Direction Générale, Rawbank" />
          </Field>
          <Field label="Client concerné" hint="Facultatif.">
            <Select value={v.client_id ?? ""} onChange={maj("client_id")}>
              <option value="">— Aucun —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.denomination}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date de la lettre"><Input type="date" value={v.date_lettre ?? ""} onChange={maj("date_lettre")} /></Field>
          <Field label={transmise ? "Envoyée le" : "Arrivée le"}>
            <Input type="date" value={v.date_envoi ?? ""} onChange={maj("date_envoi")} />
          </Field>
          <Field label={transmise ? "Accusé obtenu le" : "Accusé donné le"}>
            <Input type="date" value={v.date_reception ?? ""} onChange={maj("date_reception")} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Porteur" hint="Qui l'a portée, ou par quel canal.">
            <Input value={v.porteur ?? ""} onChange={maj("porteur")} placeholder="Remise en main propre" />
          </Field>
          <Field label="Statut">
            <Select value={v.statut} onChange={maj("statut")}>
              <option value="brouillon">{transmise ? "Brouillon" : "Enregistrée"}</option>
              <option value="envoye">{transmise ? "Envoyée" : "En traitement"}</option>
              <option value="receptionne">{transmise ? "Réceptionnée" : "Accusé donné"}</option>
            </Select>
          </Field>
        </div>

        <Field label="Contenu ou notes">
          <textarea
            value={v.contenu ?? ""} onChange={maj("contenu")} rows={4}
            placeholder="Résumé de la lettre, points à retenir, suite à donner…"
            className="w-full rounded border border-ciel-300 bg-white px-3 py-2 text-sm placeholder-ciel-300 focus:border-acier focus:outline-none focus:ring-1 focus:ring-acier"
          />
        </Field>

        {!v.id && (
          <p className="rounded border border-ciel-300 bg-ciel-50 px-3 py-2 text-xs text-acier">
            Le PDF et l'accusé se joignent depuis la fiche, une fois la lettre enregistrée.
          </p>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-2 border-t border-ciel-100 pt-4">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={valider}><Check size={15} /> Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}
