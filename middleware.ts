import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session et ferme la porte.
 *
 * ⚠️ LE PIÈGE, ET IL COÛTE CHER :
 * `supabase.auth.getUser()` peut rafraîchir le jeton et poser de nouveaux
 * cookies. Ces cookies atterrissent sur `response`. Si l'on retourne ensuite un
 * NextResponse.redirect() tout neuf, ils sont perdus : le navigateur n'a jamais
 * la session, le middleware ne voit jamais d'utilisateur, et l'on boucle entre
 * / et /login. En navigation douce, aucune erreur ne s'affiche — la page reste
 * simplement figée.
 *
 * D'où la règle : toute redirection RECOPIE les cookies de `response`.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  /** Redirige SANS perdre les cookies posés par le rafraîchissement. */
  const rediriger = (vers: string) => {
    const url = request.nextUrl.clone();
    url.pathname = vers;
    url.search = "";
    const redirection = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirection.cookies.set(c));
    return redirection;
  };

  if (!user && path !== "/login") return rediriger("/login");
  if (user && path === "/login") return rediriger("/");

  return response;
}

export const config = {
  // Le middleware ne tourne pas sur les fichiers statiques ni sur les routes
  // d'API : la route admin fait sa propre vérification, plus stricte.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
