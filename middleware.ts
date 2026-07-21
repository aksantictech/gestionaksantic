import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session et ferme la porte.
 *
 * ⚠️ RÈGLE DES COOKIES : `getUser()` peut rafraîchir le jeton et poser de
 * nouveaux cookies sur `response`. Toute redirection doit RECOPIER ces cookies,
 * sinon la session est perdue et l'on boucle entre / et /login.
 *
 * ⚠️ ROBUSTESSE EDGE : le middleware s'exécute sur le réseau Edge. Si les
 * variables d'environnement manquent, createServerClient reçoit undefined et
 * lève une exception — c'est le MIDDLEWARE_INVOCATION_FAILED qui fait tomber
 * TOUT le site. On préfère laisser passer la requête et laisser la page gérer
 * l'authentification : mieux vaut une page qui redirige qu'un site mort.
 */
export async function middleware(request: NextRequest) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Variables absentes → on ne fait pas crasher le site. La page /diagnostic
  // dira quoi corriger, et app/page.tsx protège déjà l'accès côté serveur.
  if (!URL || !ANON) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(URL, ANON, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;

    const rediriger = (vers: string) => {
      const url = request.nextUrl.clone();
      url.pathname = vers;
      url.search = "";
      const redirection = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirection.cookies.set(c));
      return redirection;
    };

    const libre = path === "/login" || path === "/diagnostic";
    if (!user && !libre) return rediriger("/login");
    if (user && path === "/login") return rediriger("/");

    return response;
  } catch (e) {
    // Jamais faire tomber le site depuis le middleware. En cas d'échec Edge,
    // on laisse passer : app/page.tsx revérifie la session côté serveur.
    console.error("middleware:", e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
