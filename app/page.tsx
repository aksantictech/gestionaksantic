import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import Gestion from "@/components/gestion";
import type { Profile } from "@/lib/types";

/**
 * Portier de l'application.
 *
 * ⚠️ RÈGLE NEXT.JS : redirect() fonctionne en LANÇANT une exception. Il ne doit
 * JAMAIS se trouver dans un try/catch, sinon le catch avale la redirection et
 * la transforme en « Server Components render error ». On isole donc la partie
 * qui peut échouer (récupération de session et profil) dans une fonction à part,
 * et les redirect() vivent hors de tout catch.
 */

async function chargerSession(): Promise<
  | { etat: "connecte"; profil: Profile }
  | { etat: "anonyme" }
  | { etat: "erreur"; message: string }
> {
  try {
    const supabase = await supabaseServer();

    const { data: { user }, error: errUser } = await supabase.auth.getUser();
    if (errUser || !user) return { etat: "anonyme" };

    const { data: profil, error: errProfil } = await supabase
      .from("profiles").select("*").eq("id", user.id).single<Profile>();

    if (errProfil) return { etat: "erreur", message: errProfil.message };
    if (!profil || !profil.is_active) return { etat: "anonyme" };

    return { etat: "connecte", profil };
  } catch (e) {
    return { etat: "erreur", message: (e as Error).message };
  }
}

export default async function Page() {
  const r = await chargerSession();

  // Les redirect() sont ICI, hors du try/catch : intouchés, ils font leur office.
  if (r.etat === "anonyme") redirect("/login");

  if (r.etat === "erreur") {
    // Plutôt qu'un 500 opaque, une page lisible qui nomme le problème et pointe
    // vers le diagnostic. app/error.tsx prendrait aussi le relais, mais ceci est
    // plus parlant pour ce cas précis.
    return (
      <main className="flex min-h-screen items-center justify-center bg-ciel-50 p-6">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-carte ring-1 ring-ciel-100">
          <h1 className="text-lg font-bold text-navy-900">Connexion à la base impossible</h1>
          <p className="mt-2 text-sm text-acier">
            Le serveur n'a pas pu lire votre profil. C'est presque toujours une
            variable d'environnement manquante sur l'hébergeur, ou une table
            absente.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-ciel-50 p-3 text-xs text-red-700">{r.message}</pre>
          <div className="mt-5 flex gap-2">
            <a href="/diagnostic" className="flex-1 rounded-lg bg-navy-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-navy-700">
              Ouvrir le diagnostic
            </a>
            <a href="/login" className="flex-1 rounded-lg border border-ciel-100 px-4 py-2.5 text-center text-sm text-navy-900 hover:bg-ciel-50">
              Connexion
            </a>
          </div>
        </div>
      </main>
    );
  }

  return <Gestion profil={r.profil} />;
}
