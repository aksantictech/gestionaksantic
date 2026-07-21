import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Page de diagnostic — à supprimer une fois l'application stable.
 *
 * Elle ne dit qu'une chose, mais c'est la seule qui manque : ce que le SERVEUR
 * voit. Le navigateur, lui, on sait déjà ce qu'il a. Aucun secret n'est affiché,
 * seulement leur présence et leur longueur.
 */

export const dynamic = "force-dynamic";

export default async function Diagnostic() {
  const store = await cookies();
  const tous = store.getAll();
  const sb = tous.filter((c) => c.name.startsWith("sb-"));

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let user: string | null = null;
  let erreurAuth: string | null = null;
  let profil: string | null = null;

  if (URL && ANON) {
    try {
      const supabase = createServerClient(URL, ANON, {
        cookies: { getAll: () => store.getAll(), setAll: () => {} },
      });
      const { data, error } = await supabase.auth.getUser();
      user = data.user?.email ?? null;
      erreurAuth = error?.message ?? null;

      if (data.user) {
        const { data: p, error: e2 } = await supabase
          .from("profiles").select("email, role, is_active").eq("id", data.user.id).single();
        profil = p ? JSON.stringify(p) : `ERREUR : ${e2?.message}`;
      }
    } catch (e) {
      erreurAuth = `EXCEPTION : ${(e as Error).message}`;
    }
  }

  const L = ({ k, v, ok }: { k: string; v: string; ok: boolean }) => (
    <tr className="border-b border-slate-200">
      <td className="py-2 pr-6 align-top font-medium text-slate-500">{k}</td>
      <td className="py-2 pr-4 align-top">
        <span className={ok ? "text-emerald-700" : "text-red-700"}>{ok ? "OK" : "PROBLÈME"}</span>
      </td>
      <td className="py-2 align-top font-mono text-xs text-slate-800">{v}</td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-3xl p-8 font-sans">
      <h1 className="text-2xl font-bold">Diagnostic serveur</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ce que le serveur voit. Aucun secret n'est affiché. Supprimez
        <code className="mx-1 rounded bg-slate-100 px-1">app/diagnostic/</code>
        une fois le problème réglé.
      </p>

      <table className="mt-6 w-full text-sm">
        <tbody>
          <L k="NEXT_PUBLIC_SUPABASE_URL" ok={!!URL} v={URL ?? "ABSENTE"} />
          <L k="NEXT_PUBLIC_SUPABASE_ANON_KEY" ok={!!ANON} v={ANON ? `présente, ${ANON.length} caractères` : "ABSENTE"} />
          <L k="SUPABASE_SERVICE_ROLE_KEY" ok={!!SERVICE} v={SERVICE ? `présente, ${SERVICE.length} caractères` : "ABSENTE"} />
          <L k="Cookies reçus" ok={tous.length > 0} v={`${tous.length} au total`} />
          <L
            k="Cookies Supabase"
            ok={sb.length > 0}
            v={sb.length ? sb.map((c) => `${c.name} (${c.value.length} car.)`).join(" · ") : "AUCUN — le serveur ne reçoit pas la session"}
          />
          <L k="Utilisateur vu par le serveur" ok={!!user} v={user ?? "AUCUN"} />
          <L k="Erreur d'authentification" ok={!erreurAuth} v={erreurAuth ?? "aucune"} />
          <L k="Profil en base" ok={!!profil && !profil.startsWith("ERREUR")} v={profil ?? "non interrogé"} />
        </tbody>
      </table>

      <div className="mt-8 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold">Comment lire ce tableau</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Cookies Supabase : AUCUN</strong> → le navigateur n'envoie pas la session au serveur. Domaine ou cookies bloqués.</li>
          <li><strong>Cookies présents mais utilisateur AUCUN</strong> → le serveur reçoit la session mais la refuse. Jeton expiré, ou clé anon différente de celle du projet.</li>
          <li><strong>Utilisateur OK mais l'application boucle</strong> → le serveur voit tout ; le blocage est dans le middleware ou le cache du routeur.</li>
          <li><strong>Une variable ABSENTE</strong> → à ajouter dans Vercel, puis redéployer.</li>
        </ul>
      </div>
    </main>
  );
}
