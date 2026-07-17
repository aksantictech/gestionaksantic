import { createBrowserClient } from "@supabase/ssr";

/**
 * Client navigateur — utilisable depuis un composant "use client".
 *
 * Ce fichier ne doit JAMAIS importer next/headers, cookies, ni quoi que ce soit
 * de réservé au serveur : tout ce qu'il importe part dans le bundle du navigateur.
 * C'est la raison d'être de la séparation avec supabase-server.ts.
 *
 * La RLS de Postgres s'applique à chaque requête : c'est elle qui protège les
 * données, pas le fait de masquer un bouton.
 */
export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
