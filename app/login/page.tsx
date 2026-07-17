"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { SOCIETE } from "@/lib/money";
import { Loader2 } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [charge, setCharge] = useState(false);

  const connecter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setCharge(true);

    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: mdp,
    });

    if (error) {
      // On n'indique jamais si c'est l'email ou le mot de passe qui est faux :
      // ça révélerait quels comptes existent.
      setErreur("Adresse ou mot de passe incorrect.");
      setCharge(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profil } = await supabase
      .from("profiles").select("is_active").eq("id", user!.id).single();

    if (profil && !profil.is_active) {
      await supabase.auth.signOut();
      setErreur("Ce compte a été désactivé. Contactez un administrateur.");
      setCharge(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Le bloc navy : la marque, à l'échelle où elle se lit. */}
      <div className="hidden flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-white font-mono text-sm font-bold text-navy-900">
            AT
          </div>
          <span className="text-lg font-semibold tracking-tight">Aksantic</span>
        </div>

        <div>
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Le registre de l'entreprise.
          </p>
          <p className="mt-4 max-w-md text-ciel-300">
            Clients, factures, encaissements, dépenses, contrats, équipe. Un seul endroit,
            à jour, consultable depuis Kinshasa comme d'ailleurs.
          </p>
        </div>

        <dl className="space-y-1 font-mono text-xs text-ciel-300">
          <div className="flex gap-3"><dt className="w-14 text-acier-500">RCCM</dt><dd>{SOCIETE.rccm}</dd></div>
          <div className="flex gap-3"><dt className="w-14 text-acier-500">Id.Nat</dt><dd>{SOCIETE.idNat}</dd></div>
        </dl>
      </div>

      {/* Le formulaire */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <form onSubmit={connecter} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-navy-900 font-mono text-sm font-bold text-white">
              AT
            </div>
            <span className="text-lg font-semibold">Aksantic</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
          <p className="mt-1 text-sm text-acier">Avec l'adresse fournie par votre administrateur.</p>

          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-acier">
                Adresse email
              </span>
              <input
                type="email" required autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@aksantictech.com"
                className="w-full rounded border border-ciel-300 px-3 py-2.5 text-sm placeholder-ciel-300 focus:border-acier focus:outline-none focus:ring-1 focus:ring-acier"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-acier">
                Mot de passe
              </span>
              <input
                type="password" required autoComplete="current-password"
                value={mdp} onChange={(e) => setMdp(e.target.value)}
                className="w-full rounded border border-ciel-300 px-3 py-2.5 text-sm focus:border-acier focus:outline-none focus:ring-1 focus:ring-acier"
              />
            </label>

            {erreur && (
              <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erreur}
              </p>
            )}

            <button
              type="submit" disabled={charge}
              className="flex w-full items-center justify-center gap-2 rounded bg-navy-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
            >
              {charge ? <><Loader2 size={15} className="animate-spin" /> Connexion…</> : "Se connecter"}
            </button>
          </div>

          <p className="mt-6 text-xs text-acier">
            Pas de compte ? Les comptes sont créés par un administrateur depuis l'onglet Admin.
          </p>
        </form>
      </div>
    </div>
  );
}
