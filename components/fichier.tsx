"use client";

import { useRef, useState } from "react";
import { FileUp, FileCheck2, Download, Trash2, Loader2 } from "lucide-react";
import { televerser, lienSigne, supprimer, nomSur, TAILLE_MAX } from "@/lib/storage";

/**
 * Dépôt d'un fichier rattaché à une fiche.
 *
 * Le fichier n'est déposé qu'une fois la fiche enregistrée : il faut un
 * identifiant pour le ranger. Fabriquer cet identifiant avant l'enregistrement,
 * c'est comment on se retrouve avec des PDF orphelins dans le bucket.
 */
export function Fichier({
  dossier, base, chemin, nom, onChange, libelle = "Joindre un PDF", accept = "application/pdf",
}: {
  dossier: string;          // ex: "contrats"
  base: string;             // ex: l'id de la fiche
  chemin: string | null;
  nom: string | null;
  onChange: (v: { path: string | null; nom: string | null }) => void;
  libelle?: string;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const choisir = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    if (f.size > TAILLE_MAX) {
      setErr("Fichier trop lourd (10 Mo maximum).");
      return;
    }
    setBusy(true);
    try {
      const p = `${dossier}/${base}/${Date.now()}-${nomSur(f.name)}`;
      await televerser(p, f);
      if (chemin) await supprimer(chemin).catch(() => {}); // l'ancien ne sert plus
      onChange({ path: p, nom: f.name });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const ouvrir = async () => {
    if (!chemin) return;
    try {
      window.open(await lienSigne(chemin), "_blank", "noopener");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const retirer = async () => {
    if (!chemin || !confirm("Retirer ce fichier ?")) return;
    setBusy(true);
    try {
      await supprimer(chemin);
      onChange({ path: null, nom: null });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input ref={input} type="file" accept={accept} className="hidden"
        onChange={(e) => choisir(e.target.files?.[0])} />

      {chemin ? (
        <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
          <FileCheck2 size={15} className="shrink-0 text-emerald-600" />
          <button onClick={ouvrir} className="min-w-0 flex-1 truncate text-left text-xs text-emerald-800 underline">
            {nom ?? "Document"}
          </button>
          <button onClick={ouvrir} title="Ouvrir" className="shrink-0 rounded p-1 text-emerald-700 hover:bg-emerald-100">
            <Download size={14} />
          </button>
          <button onClick={() => input.current?.click()} title="Remplacer"
            className="shrink-0 rounded p-1 text-acier hover:bg-emerald-100">
            <FileUp size={14} />
          </button>
          <button onClick={retirer} title="Retirer" className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50">
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => input.current?.click()} disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-ciel-300 px-3 py-2 text-xs text-acier transition-colors hover:border-acier hover:bg-ciel-50 disabled:opacity-60"
        >
          {busy ? <><Loader2 size={14} className="animate-spin" /> Envoi…</> : <><FileUp size={14} /> {libelle}</>}
        </button>
      )}

      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
