import { supabaseBrowser } from "./supabase-client";

/**
 * Fichiers — bucket privé "documents".
 *
 * Rien n'est jamais public. On ne stocke que le CHEMIN dans la base, jamais une
 * URL : une URL signée expire, la mettre en base reviendrait à enregistrer un
 * lien mort. Le lien se fabrique à la demande, au moment du clic.
 */

export const BUCKET = "documents";

/** Nettoie un nom de fichier : Supabase refuse accents, espaces et slashes. */
export const nomSur = (nom: string) =>
  nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
     .replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);

export async function televerser(chemin: string, fichier: File) {
  const supabase = supabaseBrowser();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(chemin, fichier, { upsert: true, contentType: fichier.type });
  if (error) throw new Error(error.message);
  return chemin;
}

/** Lien signé, valable une heure. Suffisant pour lire ou télécharger. */
export async function lienSigne(chemin: string) {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function supprimer(chemin: string) {
  const supabase = supabaseBrowser();
  const { error } = await supabase.storage.from(BUCKET).remove([chemin]);
  if (error) throw new Error(error.message);
}

export const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo
