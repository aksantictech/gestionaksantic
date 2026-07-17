import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Création et désactivation de comptes.
 *
 * Cette route utilise la clé service_role, qui contourne la RLS. C'est le seul
 * endroit de l'application où elle apparaît, et elle ne quitte jamais le serveur.
 * Chaque appel revérifie donc lui-même que l'appelant est admin : on ne fait pas
 * confiance au client, jamais, même si le bouton n'est affiché qu'aux admins.
 */

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

async function exigeAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erreur: "Non authentifié", code: 401 as const };

  const { data: profil } = await supabase
    .from("profiles").select("role, is_active").eq("id", user.id).single();

  if (!profil?.is_active || profil.role !== "admin") {
    return { erreur: "Réservé aux administrateurs", code: 403 as const };
  }
  return { user };
}

export async function POST(req: Request) {
  const garde = await exigeAdmin();
  if ("erreur" in garde) {
    return NextResponse.json({ erreur: garde.erreur }, { status: garde.code });
  }

  const { email, full_name, poste, role, password } = await req.json();

  if (!email?.trim() || !full_name?.trim()) {
    return NextResponse.json({ erreur: "Adresse email et nom sont obligatoires." }, { status: 400 });
  }
  if (!password || password.length < 10) {
    return NextResponse.json(
      { erreur: "Le mot de passe doit faire au moins 10 caractères." },
      { status: 400 },
    );
  }
  if (!["admin", "finance", "membre"].includes(role)) {
    return NextResponse.json({ erreur: "Rôle inconnu." }, { status: 400 });
  }

  // email_confirm: true — le compte est utilisable tout de suite.
  // Passer par l'email de confirmation supposerait un SMTP configuré ; le
  // service par défaut de Supabase est bridé et finira en spam. On transmet
  // le mot de passe de vive voix, l'utilisateur le change ensuite.
  const { data, error } = await admin().auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim(), role },
  });

  if (error) {
    const dejaPris = error.message.toLowerCase().includes("already");
    return NextResponse.json(
      { erreur: dejaPris ? "Cette adresse a déjà un compte." : error.message },
      { status: 400 },
    );
  }

  // Le trigger handle_new_user a créé le profil ; on complète le poste.
  if (poste?.trim()) {
    await admin().from("profiles").update({ poste: poste.trim() }).eq("id", data.user.id);
  }

  return NextResponse.json({ id: data.user.id });
}

export async function PATCH(req: Request) {
  const garde = await exigeAdmin();
  if ("erreur" in garde) {
    return NextResponse.json({ erreur: garde.erreur }, { status: garde.code });
  }

  const { id, is_active, role, password } = await req.json();

  if (id === garde.user.id && (is_active === false || (role && role !== "admin"))) {
    return NextResponse.json(
      { erreur: "Vous ne pouvez pas retirer vos propres accès. Demandez à un autre administrateur." },
      { status: 400 },
    );
  }

  if (password) {
    if (password.length < 10) {
      return NextResponse.json({ erreur: "Mot de passe trop court (10 caractères minimum)." }, { status: 400 });
    }
    const { error } = await admin().auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ erreur: error.message }, { status: 400 });
  }

  const champs: Record<string, unknown> = {};
  if (typeof is_active === "boolean") champs.is_active = is_active;
  if (role) champs.role = role;

  if (Object.keys(champs).length) {
    const { error } = await admin().from("profiles").update(champs).eq("id", id);
    if (error) return NextResponse.json({ erreur: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
